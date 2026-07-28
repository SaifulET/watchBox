import { getEnv } from "./env.js";

export const getRabbitMqConfig = () => {
  const env = getEnv();
  return {
    url: env.RABBITMQ_URL,
    domainExchange: env.RABBITMQ_DOMAIN_EXCHANGE,
    jobExchange: env.RABBITMQ_JOB_EXCHANGE,
    deadLetterExchange: env.RABBITMQ_DEAD_LETTER_EXCHANGE
  };
};
