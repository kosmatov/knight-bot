const
  commands = settings.game.flags.concat(settings.game.forts),
  ignore_messages = settings.fortressbot.ignore_messages

var options, chat_key

const processMessage = (data) => {
  if (data.type != 'message')  return false;

  for (let i = 0; i < ignore_messages.length; i++) {
    if (data.content.includes(ignore_messages[i])) return true;
  }

  for (var i = 0; i < commands.length; i++) {
    if (data.content.startsWith(commands[i])) {
      hero.battleTarget(commands[i])
      return true
    }
  }

  master.forward(data)
  return false
}

const updateProfile = () => game.forwardProfile(chat_key);

const regToBattle = () => {
  if (typeof options === 'undefined') return false;
  if (typeof options.battle_reg !== 'undefined' && options.battle_reg) {
    send(options.battle_reg)
  }
}

const send = (msg) => typeof chat_key !== 'undefined' ? im.send(chat_key, msg) : false;

const forward = (data) => {
  if (typeof chat_key === 'undefined') return false;

  if (typeof data.fwd_type === 'undefined') {
    logger.debug('fortressbot.forward: unknown data.fwd_type, data: ' + JSON.stringify(data))
    return false
  }

  if (typeof options.forwards === 'undefined') return false;
  if (typeof options.forwards[data.fwd_type] === 'undefined') return false;
  if (options.forwards[data.fwd_type]) return im.forward(chat_key, data);

  return false
}

const name = () => settings.im.chats[chat_key].name;

const start = (key) => {
  chat_key = key

  options = settings.fortressbot[chat_key]
  options = typeof options === 'undefined' ? {} : options

  im.register(chat_key, processMessage)
}

module.exports = {
  name: name,
  start: start,
  forward: forward,
  regToBattle: regToBattle,
  updateProfile: updateProfile,
}
