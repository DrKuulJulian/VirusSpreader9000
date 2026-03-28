require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');

const TOKEN = process.env.TOKEN;
const VIRUS_ROLE_ID = '1487316209044164629';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.once(Events.ClientReady, c => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.reference?.messageId) return;

    const repliedUser = message.mentions.repliedUser;
    if (!repliedUser) return;

    const originalMember = await message.guild.members.fetch(repliedUser.id).catch(() => null);
    if (!originalMember) return;

    const replyingMember = message.member;
    if (!replyingMember) return;

    if (replyingMember.roles.cache.has(VIRUS_ROLE_ID)) return;
    if (!originalMember.roles.cache.has(VIRUS_ROLE_ID)) return;

    await replyingMember.roles.add(VIRUS_ROLE_ID);
    console.log(`${replyingMember.user.tag} got Virus from ${originalMember.user.tag}`);
  } catch (err) {
    console.error(err);
  }
});

client.login(TOKEN);




