// Import required dependencies
require("dotenv").config();
const Discord = require("discord.js");        // Discord.js library for bot functionality
const keepAlive = require("./server");       // Keep the bot alive on Replit
const Database = require("@replit/database"); // Replit's database for storing data
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Initialize core services
const db = new Database();                   // Database instance
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent
  ]
});         // Discord client instance
// HuggingFace API configuration
const HUGGINGFACE_API = "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill";
const HUGGINGFACE_HEADERS = {
  "Authorization": `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
  "Content-Type": "application/json"
};

// Words that trigger romantic responses
const romanticWords = ["lonely", "single", "heartbroken", "miss you", "love"];

// Starter flirty messages as fallback when AI fails
const starterEncouragements = [
  "Cheer up!",
  "Hang in there!",
  "You are a great person!",
  "Don't give up!"
];

const starterFlirts = [
  "You're making my circuits spark! ✨",
  "Is it hot in here, or is it just your presence? 🔥",
  "You had me at 'Hello World' 💻",
  "Are you a keyboard? Because you're just my type! ⌨️",
  "Are you a compiler? Because you turn my code into something special! 💝",
  "You must be JavaScript because you make my world dynamic! 💫",
  "If you were a function, you'd be called beautiful()! 🌟",
  "You've got me stuck in an infinite loop of admiration! 💞"
];

const sadWords = ["sad", "depressed", "unhappy", "angry", "miserable"];
const flirtTriggers = ["hey", "hi", "hello", "sup"];

async function generateFlirtyResponse(username, message) {
  // Clean and prepare the user's message
  const cleanMessage = message.toLowerCase().trim();

  // Generate a contextual prompt based on the message content
  let prompt = '';
  if (message) {
    if (cleanMessage.includes('hello') || cleanMessage.includes('hi') || cleanMessage.includes('hey')) {
      prompt = `${username} just said hello! Generate a warm and flirty greeting. write atleast 300words`;
    } else if (cleanMessage.includes('love') || cleanMessage.includes('heart')) {
      prompt = `${username} is talking about love! Generate a romantic response. write atleast 300words`;
    } else if (cleanMessage.includes('sad') || cleanMessage.includes('lonely')) {
      prompt = `${username} is feeling down. Generate a comforting and flirty message. write atleast 300words`;
    } else {
      prompt = `Read the message${message} understand the context and try flirt with them. If they are kinky and make sure you are kinky as well. I repeat read the user message in depth understand their affection and generate a message that extremely relevant to their message also dont forget to include ${username}! write atleast 300words`;
    }
  }

  try {
    const response = await fetch(HUGGINGFACE_API, {
      method: "POST",
      headers: HUGGINGFACE_HEADERS,
      body: JSON.stringify({
        inputs: prompt
      }),
    });
    const data = await response.json();

    // Handle both array and direct response formats together
    const generatedText = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;

    if (generatedText) {
      return generatedText + " 💖";
    }

    // If no valid response, use fallback
    return `${starterFlirts[Math.floor(Math.random() * starterFlirts.length)]} Hey ${username}! 💝`;
  } catch (error) {
    console.error("Error generating flirty message:", error);
    const fallback = starterFlirts[Math.floor(Math.random() * starterFlirts.length)];
    return `${fallback} Hey ${username}! 💝`;
  }
}

db.get("encouragements").then(encouragements => {
  if (!encouragements || encouragements.length < 1) {
    db.set("encouragements", starterEncouragements);
  }
});

db.get("responding").then(value => {
  if (value == null) {
    db.set("responding", true);
  }
});

db.get("isFlirting").then(value => {
  if (value == null) {
    db.set("isFlirting", true);
  }
});

// Add a new flirty message to the database
function updateEncouragements(encouragingMessage) {
  db.get("encouragements").then(messages => {
    messages.push(encouragingMessage);
    db.set("encouragements", messages);
  });
}

// Delete a flirty message from the database by index
function deleteEncouragement(index) {
  db.get("encouragements").then(messages => {
    if (messages && messages.length > index) {
      messages.splice(index, 1);
      db.set("encouragements", messages);
    }
  });
}

function getQuote() {
  return fetch("https://zenquotes.io/api/random")
    .then(res => {
      return res.json();
    })
    .then(data => {
      return data[0]["q"] + " -" + data[0]["a"];
    });
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Ready to go all out in love! 💕`);
});

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  if (msg.content === "$inspire") {
    getQuote().then(quote => msg.channel.send(quote));
  }

  db.get("responding").then(responding => {
    if (responding && sadWords.some(word => msg.content.includes(word))) {
      db.get("encouragements").then(encouragements => {
        const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
        msg.reply(encouragement);
      });
    }
  });

  if (msg.content.startsWith("$new")) {
    const encouragingMessage = msg.content.split("$new ")[1];
    updateEncouragements(encouragingMessage);
    msg.channel.send("New encouraging message added.");
  }

  if (msg.content.startsWith("$del")) {
    const index = parseInt(msg.content.split("$del ")[1]);
    deleteEncouragement(index);
    msg.channel.send("Encouraging message deleted.");
  }

  if (msg.content.startsWith("$list")) {
    db.get("encouragements").then(encouragements => {
      msg.channel.send(encouragements);
    });
  }

  if (msg.content.startsWith("$responding")) {
    const value = msg.content.split("$responding ")[1];
    if (value.toLowerCase() == "true") {
      db.set("responding", true);
      msg.channel.send("Responding is on.");
    } else {
      db.set("responding", false);
      msg.channel.send("Responding is off.");
    }
  }

  const isFlirting = await db.get("isFlirting");
  if (!isFlirting) return;

  if (msg.mentions.has(client.user)) {
    const flirtyResponse = await generateFlirtyResponse(msg.author.username, msg.content);
    msg.reply(flirtyResponse);
    return;
  }

  const message = msg.content.toLowerCase();
  if (flirtTriggers.some(trigger => message.includes(trigger))) {
    const flirtyResponse = await generateFlirtyResponse(msg.author.username, msg.content);
    msg.reply(flirtyResponse);
  }

  if (msg.content.startsWith("$flirting")) {
    const value = msg.content.split("$flirting ")[1];
    if (value?.toLowerCase() === "true") {
      db.set("isFlirting", true);
      msg.channel.send("Flirting mode is on! 💖");
    } else {
      db.set("isFlirting", false);
      msg.channel.send("Flirting mode is off! 🤐");
    }
  }
});

keepAlive();

client.on('error', error => {
  console.error('Discord client error:', error);
});

client.login(process.env.TOKEN).catch(error => {
  console.error('Failed to login to Discord:', error);
});
