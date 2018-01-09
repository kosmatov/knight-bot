const
  commands = settings.banker.commands,
  contents = settings.banker.contents

var
  chat_key = ''
  prices = {}
  prices_load = false
  prices_updated = 0

const processMessage = (data) => {
  if (data.type != 'message') return false;
  if (data.content.includes(contents.prices) && prices_load) loadPrices(data);

  if (data.content.includes(contents.got) || data.content.includes(contents.lost)) {
    master.forward(data)
  }
}

const loadPrices = (data) => {
  var numbers = data.content.match(/\d+/g)
  logger.debug('banker.loadPrices: ' + JSON.stringify(numbers))

  for (var i = 0; i < numbers.length - 2; i += 2) {
    prices[numbers[i]] = parseInt(numbers[i + 1])
  }

  prices_updated = Date.now()
  prices_load = false
}

const getPrices = () => {
  if (Date.now() - prices_updated > 3600000 && !prices_load) {
    prices_load = true
    im.send(chat_key, commands.prices)
    setTimeout(() => prices_load = false, 300000)
    return false
  }

  return prices
}

const start = (key) => {
  chat_key = key
  logger.debug('banker.start: ' + key)
  im.register(key, processMessage)
}

module.exports = {
  start: start,
  prices: getPrices,
  send: (data) => im.send(chat_key, data),
  forward: (data) => im.forward(chat_key, data),
}
