import amqp from "amqplib";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const startSendOtpConsumer = async () => {
  try {
    const connection = await amqp.connect({
      protocol: "amqp",
      hostname: process.env.RabbitMQ_Host,
      port: 5672,
      username: process.env.RabbitMQ_Username,
      password: process.env.RabbitMQ_Password,
    });
    const channel = await connection.createChannel();
    const queueName = "send-otp";
    await channel.assertQueue(queueName, { durable: true });
    console.log("Waiting for messages in queue:", queueName);
    channel.consume(queueName, async (message) => {
      if (message) {
        const { to, subject, body } = JSON.parse(message.content.toString());
        // Send email using nodemailer
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            text: body,
          });
          console.log(`Email sent to ${to}`);
          channel.ack(message);
        } catch (error) {
          console.log(`Failed to send otp to ${to}:`, error);
          channel.nack(message, false, true); // Requeue the message
        }
      } else {
        console.log("Received null message");
      }
    });
  } catch (error) {
    console.log("Error in startSendOtpConsumer:", error);
  }
};
