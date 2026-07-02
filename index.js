require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, PermissionsBitField, MessageFlags } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const VIRUS_ROLE_ID = process.env.VIRUS_ROLE_ID;
const BAN_ROLE_ID = '1522207873772421220'

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
        name: 'privacypolicy',
        description: 'View the privacy policy for VirusSpreader9000.'
      },
      {
        name: 'endgameban',
        description: 'Assign the Endgame ban role to a user.',
        options: [
          {
            name: 'userid',
            description: 'The ID of the user to ban.',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'virushelp',
        description: 'Learn how the virus spreads and how to stay safe.'
      }
    ]);
    console.log('Slash commands registered!');
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
        content: `There are currently **${count}** infected people in the server.`, 
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

  if (interaction.commandName === 'privacypolicy') {
    try {
      const ppMessage =
        `**VirusSpreader9000 — Privacy Policy**\n\n` +
        `This bot does **not** collect, store, or share any personal data.\n\n` +
        `**What it accesses:**\n` +
        `• Message content — only to detect the 😷 emoji. Not stored.\n` +
        `• Server member list — only to check and assign the Virus role. Not stored.\n` +
        `• User IDs — used temporarily during role assignment. Not stored.\n\n` +
        `**Full policy:** [github.com](https://github.com/DrKuulJulian/VirusSpreader9000/blob/main/PRIVACY_POLICY.md)`;

      await interaction.reply({
        content: ppMessage,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error handling /privacypolicy command:', error);
    }
  }

  if (interaction.commandName === 'endgameban') {
    try {
      const BAN_ROLE_ID = process.env.BAN_ROLE_ID;
      const userId = interaction.options.getString('userid');

      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        await interaction.reply({
          content: `Could not find a member with ID \`${userId}\`.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (member.roles.cache.has(BAN_ROLE_ID)) {
        await interaction.reply({
          content: `${member.user.tag} already has the ban role.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await member.roles.add(BAN_ROLE_ID);

      await interaction.reply({
        content: `Applied ban role to **${member.user.tag}**.`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Error handling /endgameban command:', error);
      if (!interaction.replied) {
        await interaction.reply({
          content: 'Something went wrong.',
          flags: MessageFlags.Ephemeral
        }).catch(() => null);
      }
    }
  }


  //help command
  if (interaction.commandName === 'virushelp') {
    try {
      const helpMessage = `**Endgame**\n\n` +
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
