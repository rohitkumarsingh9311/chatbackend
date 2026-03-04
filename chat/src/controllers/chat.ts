import { Response } from "express";
import TryCatch from "../config/TryCatch.js";
import { AuthenticatedRequest, IUser } from "../middlewares/isAuth.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/Messages.js";
import axios from "axios";
import { getReciverSocketId, io } from "../config/socket.js";

export const createNewChat = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;
    const { otherUserId } = req.body;
    if (!otherUserId) {
      res.status(400).json({ message: "otherUserId is required" });
      return;
    }

    const existingChat = await Chat.findOne({
      users: { $all: [userId, otherUserId], $size: 2 },
    });

    if (existingChat) {
      res.status(200).json({
        message: "Chat already exists",
        chatId: existingChat._id,
      });
      return;
    }
    const newChat = await Chat.create({
      users: [userId, otherUserId],
    });

    res.status(201).json({
      message: "New Chat created successfully",
      chatId: newChat?._id,
    });
  },
);

export const getAllChats = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      res.status(400).json({ message: "User not found" });
      return;
    }
    const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });
    const chatwithUserData = await Promise.all(
      chats.map(async (chat) => {
        const otherUserId = chat.users.find((id) => id.toString() !== userId);
        console.log("userID", userId);
        const unseenMessagesCount = await Message.countDocuments({
          chatId: chat._id,
          seen: false,
          sender: { $ne: userId },
        });
        try {
          const { data } = await axios.get(
            `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`,
          );
          return {
            user: data,
            chat: {
              ...chat.toObject(),
              latestMessage: chat.latestMessage || null,
              unseenMessagesCount,
            },
          };
        } catch (error) {
          return {
            user: { _id: otherUserId, name: "Unknown User" },
            chat: {
              ...chat.toObject(),
              latestMessage: chat.latestMessage || null,
              unseenMessagesCount,
            },
          };
        }
      }),
    );

    res
      .status(200)
      .json({ message: "Chats fetched successfully", chats: chatwithUserData });
  },
);

export const sendMessage = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const senderId = req.user?._id;
    const { chatId, text } = req.body;
    const imageFile = req.file;

    if (!senderId) {
      res.status(400).json({ message: "User not found" });
      return;
    }
    if (!chatId) {
      res.status(400).json({ message: "chatId is required" });
      return;
    }
    if (!text && !imageFile) {
      res.status(400).json({ message: "Either text or image is required" });
      return;
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }
    const isUserInChat = await chat.users.some(
      (userId) => userId.toString() === senderId,
    );
    if (!isUserInChat) {
      res.status(403).json({ message: "You are not a member of this chat" });
      return;
    }

    const otherUserId = chat.users.find(
      (userId) => userId.toString() !== senderId,
    );
    if (!otherUserId) {
      res.status(400).json({ message: "Other user not found in chat" });
      return;
    }

    // socket setup
    const receiverSocketId = getReciverSocketId(otherUserId.toString());
    let isReciverInChatRoom = false;

    if (receiverSocketId) {
      const receiverSocket = io.sockets.sockets.get(receiverSocketId);
      if (receiverSocket && receiverSocket.rooms.has(chatId)) {
        isReciverInChatRoom = true;
      }
    }

    let messageData: any = {
      chatId: chatId,
      sender: senderId,
      seen: isReciverInChatRoom,
      seenAt: isReciverInChatRoom ? new Date() : undefined,
    };

    if (imageFile) {
      messageData.messageType = "image";
      messageData.image = {
        url: imageFile.path,
        publicId: imageFile.filename,
      };
      messageData.text = text || "";
    } else {
      messageData.messageType = "text";
      messageData.text = text;
    }

    const message = new Message(messageData);
    const savedMessage = await message.save();

    const latestMessageText = imageFile ? "📷 image" : text;
    await Chat.findByIdAndUpdate(
      chatId,
      {
        latestMessage: {
          text: latestMessageText,
          sender: senderId,
        },
        updatedAt: new Date(),
      },
      { returnDocument: "after" },
    );

    //emit to socket
    io.to(chatId).emit("newMessage", savedMessage);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", savedMessage);
    }

    const senderSocketId = getReciverSocketId(senderId.toString());
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", savedMessage);
    }

    if (isReciverInChatRoom && senderSocketId) {
      io.to(senderSocketId).emit("messagesSeen", {
        chatId: chatId,
        seenBy: otherUserId,
        messageIds: [savedMessage._id],
      });
    }
    res.status(201).json({
      message: savedMessage,
      sender: senderId,
    });
  },
);

export const getchatMessages = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;
    const chatId = req.params.chatId;
    if (!userId) {
      res.status(400).json({ message: "User not found" });
      return;
    }
    if (!chatId) {
      res.status(400).json({ message: "chatId is required" });
      return;
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }
    const isUserInChat = await chat.users.some(
      (userId) => userId.toString() === userId,
    );
    if (!isUserInChat) {
      res.status(403).json({ message: "You are not a member of this chat" });
      return;
    }
    const messagesToMarkSeen = await Message.find({
      chatId: chatId,
      seen: false,
      sender: { $ne: userId },
    });

    await Message.updateMany(
      {
        chatId: chatId,
        seen: false,
        sender: { $ne: userId },
      },
      { seen: true, seenAt: new Date() },
    );

    const messages = await Message.find({ chatId: chatId }).sort({
      createdAt: 1,
    });

    const otherUserId = chat.users.find((id) => id.toString() !== userId);
    try {
      const { data } = await axios.get(
        `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`,
      );
      if (!otherUserId) {
        res.status(400).json({ message: "No other user" });
        return;
      }

      //socket work

      if (messagesToMarkSeen.length > 0) {
        const otherUserSocketId = getReciverSocketId(otherUserId.toString());
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit("messagesSeen", {
            chatId: chatId,
            seenBy: userId,
            messageIds: messagesToMarkSeen.map((msg) => msg._id),
          });
        }
      }

      res.json({
        messages,
        user: data,
      });
    } catch (error) {
      console.error("Error fetching other user data:", error);
      res.json({ messages, user: { _id: otherUserId, name: "Unknown User" } });
    }
  },
);
