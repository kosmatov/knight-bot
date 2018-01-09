const contents = settings.groupchat.contents

const start = (chat_key) => {
  logger.debug('groupchat.start: ' + chat_key)
  im.register(chat_key, processMessage)
}

const commands = settings.game.flags.concat(settings.game.forts)

const processMessage = (data) => {
  if (data.type != 'message') return false;

  if (hero.inBattle()) {
    for (var i = 0; i < commands.length; i++) {
      if (data.content.includes(commands[i])) {
        hero.battleTarget(commands[i])
        break
      }
    }
  }

  if (data.chat.includes(fortressbot.name())) {
    if (data.content.includes(contents.plus1)) im.push(data, 1);
    if (data.content.includes(contents.plus2)) im.push(data, 2);
  }

  return true
}

module.exports = {
  start: start
}
