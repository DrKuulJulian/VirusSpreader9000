require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const VIRUS_ROLE_ID = process.env.VIRUS_ROLE_ID;

if (!TOKEN || !VIRUS_ROLE_ID) {
  console.error('Missing DISCORD_TOKEN or VIRUS_ROLE_ID in .env');
  process.exit(1);
}

// Create Discord client with the intents needed for replies, member lookups, and role assignment
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Confirm the bot connected successfully
client.once(Events.ClientReady, c => {
  console.log(`Logged in as ${c.user.tag}`);
});

// Spread the Virus role when someone replies to an infected user
client.on(Events.MessageCreate, async message => {
  try {
    // Ignore DMs, bots, and messages that are not replies
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.reference?.messageId) return;

    // Mask Protection: Ignores replies with a mask
    if (message.content.includes(':mask:') || message.content.includes('😷')) return;

    // Resolve the user being replied to
    const repliedUser = message.mentions.repliedUser;
    if (!repliedUser) return;

    // Ignore self-replies
    if (message.author.id === repliedUser.id) return;

    const originalMember = await message.guild.members
      .fetch(repliedUser.id)
      .catch(() => null);
    if (!originalMember) return;

    const replyingMember = message.member;
    if (!replyingMember) return;

    // Only spread if the original user has the role and the replier does not
    if (replyingMember.roles.cache.has(VIRUS_ROLE_ID)) return;
    if (!originalMember.roles.cache.has(VIRUS_ROLE_ID)) return;

    const virusRole = await message.guild.roles
      .fetch(VIRUS_ROLE_ID)
      .catch(() => null);

    if (!virusRole) {
      console.error('Virus role not found.');
      return;
    }

    const botMember = await message.guild.members
      .fetchMe()
      .catch(() => null);

    // Permission Check
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      console.error('Bot lacks ManageRoles permission.');
      return;
    }

    // Hierarchy Check
    if (!botMember) {
      console.error('Could not fetch bot member.');
      return;
    }

    // Ensure the bot is allowed to assign this role
    if (virusRole.position >= botMember.roles.highest.position) {
      console.error(
        `Cannot assign Virus role. Bot role must be higher than "${virusRole.name}".`
      );
      return;
    }

    // Give the Virus role to the replying user
    await replyingMember.roles.add(VIRUS_ROLE_ID);

    await message.guild.members.fetch();

    const infectedCount = virusRole.members.size;

    console.log(`${replyingMember.user.tag} got Virus from ${originalMember.user.tag} (${infectedCount}`);
  } catch (err) {
    console.error('Virus spread failed:', err);
  }
});

client.login(TOKEN);