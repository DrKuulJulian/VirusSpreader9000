require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, PermissionsBitField, MessageFlags } = require('discord.js');

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
client.once(Events.ClientReady, async c => {
  console.log(`Logged in as ${c.user.tag}`);

  for (const guild of c.guilds.cache.values()) {
    await guild.members.fetch().catch(() => null);
  }
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

    // Hierarchy Check
    if (!botMember) {
      console.error('Could not fetch bot member.');
      return;
    }

    // Permission Check
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      console.error('Bot lacks ManageRoles permission.');
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
    await message.react('💉').catch(() => null);

    virusRole.members.set(replyingMember.id, replyingMember);

    const infectedCount = virusRole.members.size;

    const time = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit'
    });

    const channelName = message.channel.name || 'unknown';

    console.log(`[${time}] #${channelName} ${originalMember.user.tag} infected ${replyingMember.user.tag} (${infectedCount})`);
  } catch (err) {
    console.error('Virus spread failed:', err);
  }
});

//commands
client.once(Events.ClientReady, async c => {
  try {
    await c.application.commands.set([
      {
        name: 'infected',
        description: 'Check how many people currently have the virus.'
      },
      {
        name: 'virushelp',
        description: 'Learn how the virus spreads and how to stay safe.'
      }
    ]);
    console.log('Slash commands /infected and /virushelp registered!');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

//infected command
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'infected') {
    try {
      // Fetch the role from the server
      const virusRole = await interaction.guild.roles.fetch(VIRUS_ROLE_ID).catch(() => null);

      if (!virusRole) {
        await interaction.reply({ 
          content: 'Error: Could not find the Virus role on this server.', 
          flags: MessageFlags.Ephemeral //private
        });
        return;
      }

      const count = virusRole.members.size;
      await interaction.reply({ 
        content: `There are currently **${count}** infected people in the server. 🦠`, 
        flags: MessageFlags.Ephemeral 
      });

    } catch (error) {//fallback error handling
      console.error('Error handling /infected command:', error);

      if (!interaction.replied) {
        await interaction.reply({ 
          content: 'Something went wrong while counting the infected.', 
          flags: MessageFlags.Ephemeral 
        }).catch(() => null);
      }
    }
  }

  //help command
  if (interaction.commandName === 'virushelp') {
    try {
      const helpMessage = `**Endgame Shenanigans**\n\n` +
                          `**How it spreads:** If you reply to a message from someone who is infected, you will catch the virus too\n` +
                          `**How to stay safe:** If you must reply to an infected person, include the 😷 or \`:mask:\` emoji in your message to protect yourself.\n\n` +
                          `**Commands:**\n` +
                          `\`/infected\` - See the total number of infected members.\n` +
                          `\`/virushelp\` - Show this guide.`;

      await interaction.reply({ 
        content: helpMessage, 
        flags: MessageFlags.Ephemeral  
      });
    } catch (error) {
      console.error('Error handling /virushelp command:', error);
    }
  }
});

client.login(TOKEN);
