const start = (key) => {
  logger.debug('raidboss.start: ' + key)
  im.register(key, processMessage)
}

const processMessage = (data) => {
  let min_level = settings.im.chats[data.chat_key].opts.min_level,
    max_level = settings.im.chats[data.chat_key].opts.max_level
  if (hero.level() < min_level || hero.level() > max_level) {
    logger.debug('raidboss.processMessage: hero.level: ' + hero.level() + ' (' + min_level + '-' + max_level + ' need)')
    return false
  }

  return game.raid(data)
}

module.exports = {
  start: start
}
