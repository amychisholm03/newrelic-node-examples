'use strict'
require('dotenv').config()
const fastify = require('fastify')({ logger: true })
const { PORT: port = 3000, HOST: host = '127.0.0.1' } = process.env
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand
} = require('@aws-sdk/client-bedrock-runtime')

const client = new BedrockRuntimeClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

fastify.listen({ host, port }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})

fastify.post('/chat-completion', async (request, reply) => {
  const { message = 'Say this is a test', model = 'amazon-titan' } = request.body || {};

  // Model configurations
  const modelConfigurations = {
    // amazon titan text
    'amazon-titan': {
      modelId: 'amazon.titan-text-express-v1',
      body: { inputText: message },
    },
    // anthropic claude
    'anthropic': {
      modelId: 'anthropic.claude-v2',
      body: {
        prompt: `\n\nHuman: ${message}\n\nAssistant:`,
        max_tokens_to_sample: 200,
      },
    },
    // ai21 labs jurassic 2
    'ai21': {
      modelId: 'ai21.j2-mid-v1',
      body: { prompt: message },
    },
    // cohere
    'cohere': {
      modelId: 'cohere.command-text-v14',
      body: { prompt: message },
    },
  };

  const modelConfig = modelConfigurations[model];
  if (!modelConfig) {
    return reply.code(400).send({ error: 'Invalid model' });
  }

  const command = new InvokeModelCommand({
    body: JSON.stringify(modelConfig.body),
    modelId: modelConfig.modelId,
    contentType: 'application/json',
    accept: 'application/json',
  });

  try {
    const response = await client.send(command);
    const resBody = new TextDecoder('utf-8').decode(response.body);
    const parsedResBody = JSON.parse(resBody);

    let outputText;

    switch (model) {
      case 'amazon-titan':
        outputText = parsedResBody.results[0].outputText;
        break;
      case 'anthropic':
        outputText = parsedResBody.completion;
        break;
      case 'ai21':
        outputText = parsedResBody.completions[0].data.text;
        break;
      case 'cohere':
        outputText = parsedResBody.generations[0].text;
        break;
    }

    return reply.send({"requestId": response.$metadata.requestId, outputText});
  } catch (error) {
    return reply.code(500).send({ error: error });
  }
});

fastify.post('/chat-completion-stream', async(request, reply) => {
  const { message = 'Say this is a test', model = 'amazon-titan' } = request.body || {};

  // Model configurations
  const modelConfigurations = {
    // amazon titan text
    'amazon-titan': {
      modelId: 'amazon.titan-text-express-v1',
      body: { inputText: message },
    },
    // anthropic claude
    'anthropic': {
      modelId: 'anthropic.claude-v2',
      body: {
        prompt: `\n\nHuman: ${message}\n\nAssistant:`,
        max_tokens_to_sample: 200,
      },
    },
    // cohere
    'cohere': {
      modelId: 'cohere.command-text-v14',
      body: { prompt: message },
    },
  };

  const modelConfig = modelConfigurations[model];
  if (!modelConfig) {
    return reply.code(400).send({ error: 'Invalid model' });
  }

  const command = new InvokeModelWithResponseStreamCommand({
    body: JSON.stringify(modelConfig.body),
    modelId: modelConfig.modelId,
    contentType: 'application/json',
    accept: 'application/json',
  });

  try {
    const response = await client.send(command)
    let resChunks = [];

    for await (const payload of response.body) {
      resChunks.push(payload.chunk.bytes);
    }

    const concatenatedBuffer = Buffer.concat(resChunks);
    const byteString = new TextDecoder().decode(concatenatedBuffer);
    const outputObj = JSON.parse(JSON.stringify(byteString));

    return reply.send({"requestId": response.$metadata.requestId, outputObj});
  } catch (error) {
    return reply.code(500).send({ error: error });
  }
})

fastify.post('/embedding', async (request, reply) => {
  const { message = 'Test embedding', model = 'amazon-titan-embed' } = request.body || {}
  
  const prompt = {
    body: JSON.stringify({
      inputText: message,
    }),
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json'
  }

  const command = new InvokeModelCommand(prompt);

  try {
    const response = await client.send(command);
    const resBody = new TextDecoder('utf-8').decode(response.body);
    const parsedResBody = JSON.parse(resBody);
    const embedding = parsedResBody.embedding;

    return reply.send({"requestId": response.$metadata.requestId, embedding});
  } catch (error) {
    return reply.code(500).send({ error: error });
  }
})
