import amqplib from "amqplib";

let chennel: amqplib.Channel;

export const connectRabbitMQ = async () => {
  try {
    const connection = await amqplib.connect({
      protocol: "amqp",
      hostname: process.env.RabbitMQ_Host,
      port: 5672,
      username: process.env.RabbitMQ_Username,
      password: process.env.RabbitMQ_Password,
    });

    chennel = await connection.createChannel();
    console.log("✅ connnected to rabbitmq");
  } catch (error) {
    console.log("failed to connect to Rabbit MQ", error);
  }
};

export const publishToQueue = async (queueName: string, message: any) => {
  if (!chennel) {
    console.log("Rabbit MQ chennel is not initialized");
    return;
  }

  await chennel.assertQueue(queueName, { durable: true });
  chennel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
};
