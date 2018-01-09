const ignore_messages = settings.foremanbot.ignore_messages
var options, chat_key

const processMessage = (data) => {
  if (data.type != 'message')  return false;

  for (let i = 0; i < ignore_messages.length; i++) {
    if (data.content.includes(ignore_messages[i])) return true;
  }

  master.forward(data)
  return false
}

const forward = (data) => {
  if (typeof chat_key === 'undefined') return false;

  if (typeof data.fwd_type === 'undefined') {
    logger.debug('foremanbot.forward: unknown data.fwd_type, data: ' + JSON.stringify(data))
    return false
  }

  if (typeof options.forwards === 'undefined') return false;
  if (typeof options.forwards[data.fwd_type] === 'undefined') return false;
  if (options.forwards[data.fwd_type]) return im.forward(chat_key, data);

  return false
}

const start = (key) => {
  chat_key = key

  options = settings.foremanbot[chat_key]
  options = typeof options === 'undefined' ? {} : options

  im.register(chat_key, processMessage)
}

module.exports = {
  start: start,
  forward: forward,
}
