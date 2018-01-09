const start = (key) => {
  logger.debug('telegram.start: ' + key)
  im.register(key, processMessage)
}

const toWords = (number) => {
  var out = []

  for (var i = number.length; i > 0;) {
    out.unshift(number[--i])
    if (((number.length - i) % 3) == 0) out.unshift(' ');
  }

  return out.join('')
}

const processMessage = (data) => {
  if (data.content.includes(settings.telegram.contents.code)) {
    let number = data.content.match(/\d+/)
    if (number != null) master.send(toWords(number.toString()))
    return true
  }
  return false
}

module.exports = {
  start: start
}
