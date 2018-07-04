const commands = {
  ainf: () => send(hero.arenaInfo()),
  ares: () => send(game.arenaResults()),
  buy: () => hero.buyResources(),
  cave: () => game.sendCommand('cave'),
  chats: () => cmdChats(),
  ex: (data, cmd) => exchange(data, cmd),
  forest: () => game.sendCommand('forest'),
  hero: () => game.forwardProfile(chat_key),
  hide: () => hero.hideResources(),
  info: () => send(hero.info()),
  inv: () => game.forwardInv(chat_key),
  manual: () => game.manualMode(true),
  coins: () => game.showCoins(chat_key),
  opts: () => send(util.inspect(hero.options())),
  prices: () => prices(),
  restart: () => game.restart(),
  set: (data, cmd) => set(data, cmd),
  start: () => game.start(),
  state: () => send(game.info()),
  res: () => tradebot.show(),
  stop: () => game.stop(),
}

const cmd_help = settings.master.help.commands

var
  nickname = '@' + profile,
  chat_key

const set = (data, cmd) => {
  let args = cmd.split(' ')
  args.shift()

  let opt = args.shift()
  if (args.length == 1) args = args[0];

  logger.debug('master.set: ' + opt + ' ' + JSON.stringify(args))
  return send(util.inspect(hero.setOption(opt, args)))
}

const send = (msg) => {
  if (typeof chat_key === 'undefined' || !im.exists(chat_key)) {
    logger.debug('master.send: can\'t send to "' + chat_key + '"')
    return false
  }

  return im.send(chat_key, msg)
}

const forward = (data) => {
  if (typeof chat_key === 'undefined' || !im.exists(chat_key)) {
    logger.debug('master.send: can\'t fwd to "' + chat_key + '"')
    return false
  }

  return im.forward(chat_key, data);
}

const help = (data) => {
  if (data.type != 'command') return false;

  var text = clone(settings.master.help.desc)
  text.push('')

  for (let key in cmd_help) text.push(key + ' - ' + cmd_help[key]);
  return send(text.join("\n"))
}

const cmdChats = () => {
  var text = [], chats = im.chats()
  for (let key in chats) text.push(key + ' - ' + chats[key].name);
  send(text.join("\n"))
  return true
}

const prices = () => {
  let hprices = hero.prices(),
      res = []

  logger.debug('master.prices: ' + JSON.stringify(hprices))

  if (!hprices) {
    send('Loading prices...')
    return false
  }

  for (let i = 0; i < hprices.length; i ++) {
    let name = settings.game.contents.resources[hprices[i][0]]
    res.push(hprices[i][0] + ' ' + name + ' ' + settings.hero.contents.coins + hprices[i][1]);
  }

  send(res.join("\n"))
}

const exchange = (data, cmd) => {
  var cmd_parts = cmd.split(' ').slice(1)

  if (cmd_parts.length > 0) {
    logger.debug('master.exchange: ' + cmd + ': ' + JSON.stringify(cmd_parts))

    let act = cmd_parts.join('')

    if (act == 'flush') {
      game.moveResFromExchange()
      return true
    } else if (act == 'stock') {
      send(util.inspect(game.ex_res_stock()))
      return true
    }

    let res_id = parseInt(act)

    if (res_id < 0) {
      game.exchangeRemoveResource(Math.abs(res_id))
    } else {
      game.exchangeAddResource(res_id)
    }

    return true
  }

  game.sendCommand('exchange')
}

const imCommand = (cmd) => {
  let args = cmd.split(' ')
  let
    im_cmd = args.unshift() == 'fwd' ? 'forward' : 'send',
    chat = args.unshift()

  if (!im.exists(chat)) {
    send('Undefined chat "' + chat + '" (you can use field `chat_key`)')
    return false
  }

  im[im_cmd](chat, args.join(' '))
  return true
}

const processMessage = (data) => {
  for (let key in settings.game.alerts) {
    if (data.content.includes(settings.game.alerts[key])) return im.pin(data);
  }

  if (data.type == 'message') {
    if (game.processPrice(data)) return true;

    if (data.content.includes(settings.master.flag_sep)) {
      let target = data.content.split(settings.master.flag_sep).pop()
      logger.debug('master.processMessage: set target ' + target)
      hero.battleTarget(target)
      return true
    }
  }

  if (data.content.trim() == 'help') return help(data);
  if (!(data.content.startsWith('@') || data.content.startsWith('/'))) return false;

  var
    words = data.content.split(' '),
    cmd_parts = [],
    username = null

  for (let i = 0; i < words.length; i++) {
    let word = words[i].trim()

    if (word.length < 1) continue;

    if (word == nickname || word == '@all') username = nickname;
    else if (word.startsWith('@')) username = username || word;
    else cmd_parts.push(word);
  }

  logger.debug('master.processMessage: username: ' + username)
  if (username && username != nickname) return false;
  else if (!username && !game.manualMode()) return false;

  let cmd = cmd_parts.join(' ')
  let key = (cmd.startsWith('/') ? cmd.slice(1) : cmd).split(' ').shift()
  logger.debug('master.processMessage: cmd: ' + cmd + ', key: ' + key)

  if (cmd.startsWith('+') || cmd.match(/^b[\s\d]+/)) {
    return game.sendCommand('/wtb_' + cmd.slice(1).trim().replace(/\s+/g, '_'))
  }

  if (cmd.startsWith('-') || cmd.match(/^s[\s\d]+/)) {
    let args = cmd.slice(1).trim().match(/\d+/g)

    if (args.length < 3) {
      return game.exchangeAddResource(args[0], true, args[1])
    } else {
      return game.sendCommand(settings.game.commands.sell, args.join('_'))
    }
  }

  if (typeof commands[key] !== 'undefined') return commands[key](data, cmd);
  if (game.isCommand(cmd)) return game.sendCommand(cmd);
  if (typeof settings.game.commands[key] !== 'undefined') game.sendCommand(key);
  if (cmd.startsWith('fwd') || cmd.startsWith('msg')) return imCommand(cmd);

  return false
}

const start = (key) => {
  chat_key = key
  logger.debug('master.start: ' + key)
  im.register(key, processMessage)
}

module.exports = {
  chat_key: () => chat_key,
  start: start,
  send: send,
  forward: forward,
}
