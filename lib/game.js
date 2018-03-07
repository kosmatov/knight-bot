var
  chat_key,
  main_loop,
  last_command = '',
  last_command_time = 0,
  manual_mode = false,
  castle_commands = [],
  seafront = false,
  exchange_slots = 0,
  flush_exchange_slots = false,
  ignore_castle = false,
  send_queue = [],
  wait_answer = false,
  restarted = false,
  arena_results = [],
  prices_cached = {}

const
  flags = settings.game.flags,
  forts = settings.game.forts,
  battlehours = settings.game.battlehours,
  contents = settings.game.contents,
  commands = settings.game.commands

var command_list = []

const info = () => {
  var data = []
  let uptime = (Date.now() - time_start) / 1000
  let
    days = Math.floor(uptime / 86400),
    hours = Math.floor((uptime % 86400) / 3600),
    minutes = Math.floor((uptime % 3600) / 60),
    seconds = uptime % 60

  uptime = ''
  if (days > 0) uptime += days + 'd ';
  if (days > 0 || hours > 0) uptime += hours + 'h ';
  if (hours > 0 || minutes > 0) uptime += minutes + 'm ';
  else uptime += seconds + 's';

  let info = manual_mode ? 'in manual mode' : uptime
  data.push(main_loop ? 'Game run ' + info : 'Game stopped')

  var lcmd_time = Math.floor((Date.now() - last_command_time) / 1000)
  var lcmd_mesg = 'Sent "' + last_command + '" '

  if (lcmd_time > 60) lcmd_mesg += Math.floor(lcmd_time / 60) + 'm ago';
  else lcmd_mesg += lcmd_time + 's ago';

  data.push(lcmd_mesg)
  data.push('Battle: ' + minToBattle() + 'm Seafront: ' + seafront)
  data.push('Queue: ' + JSON.stringify(send_queue) + ' Wait: ' + wait_answer)

  return data.join("\n")
}

const minToBattle = () => {
  var d = new Date
  var h = d.getUTCHours(),
      m = d.getMinutes(),
      minutes = 0

  for (var i = 0; i < battlehours.length; i++) {
    if (h < battlehours[i]) {
      minutes = 60 * (battlehours[i] - h) - m
      break
    }
  }

  return minutes
}

const collectCommands = () => {
  var cmd_keys = Object.keys(commands),
    con_keys = Object.keys(contents.commands)

  for (var i = 0; i < cmd_keys.length; i++) {
    if (typeof commands[cmd_keys[i]] == 'object') {
      command_list = command_list.concat(commands[cmd_keys[i]])
    } else {
      command_list.push(commands[cmd_keys[i]])
    }
  }

  for (var i = 0; i < con_keys.length; i++) {
    command_list.push(contents.commands[con_keys[i]])
  }

  command_list = command_list.concat(flags).concat(forts)
}

const isCommand = (msg) => {
  if (command_list.length < 1) collectCommands();

  for (var i = 0; i < command_list.length; i++) {
    if (msg.startsWith(command_list[i])) return true;
  }

  return false
}

const detectCommand = (data) => isCommand(data.content);

const processUnknown = (data) => {
  master.forward(data)
  if (Date.now() - last_command_time > 30000) send(commands.show);
  return true
}

const processCastle = (data) => {
  if (!data.content.includes(contents.castle)) return false;

  if (data.content.includes(contents.seafront)) {
    logger.debug('game.processCastle: ' + contents.seafront)
    seafront = true
  }

  if (ignore_castle) {
    logger.debug('game.processCastle: ignore castle')
    return true
  }

  for (let i = 0; i < contents.commands.length; i++) {
    var cmd_prefix = contents.commands[i]
    var regexp = cmd_prefix.slice(1) + '[a-z]+'
    var cmd_list = data.content.match(new RegExp(regexp, 'g'))

    logger.debug('game.processCastle: ' + JSON.stringify(cmd_list))
    if (cmd_list != null) {
      castle_commands = cmd_list.map((cmd) => cmd_prefix.slice(0, 1) + cmd)
      return true
    }
  }

  return true
}

const processArena = (data) => {
  if (data.content.includes(contents.arena.fight) || data.content.includes(contents.arena.attack)) {
    hero.arenaAttack()
    return true
  } else if (data.content.includes(contents.arena.welcome)) {
    hero.loadArenaFights(data.content)
    master.send(hero.arenaInfo())
    if (hero.arenaFights() > 0 && !hero.searchEnemyStart()) hero.searchEnemy();
    return true
  } else if (data.content.includes(contents.arena.result)) {
    arena_results.push(data.content)
    send(commands.show)
    return true
  }

  var arena_messages = [
    contents.arena.defense,
    contents.arena.good_plan,
    contents.arena.search_enemy,
  ]

  for (var i = 0; i < arena_messages.length; i++) {
    if (data.content.includes(arena_messages[i])) return true;
  }

  return false
}

const processBattle = (data) => {
  if (!hero.inBattle()) return false;

  if (data.content.includes(contents.attack)) {
    hero.goAttack()
    master.send(hero.info())
    return true
  } else if (data.content.includes(contents.defense)) {
    hero.goDefense()
    master.send(hero.info())
    return true
  }

  return false
}

const processProfile = (data) => {
  if (!data.content.includes(contents.hero) || data.content.includes(contents.battle)) {
    return false
  }

  if (fwd_profile_to) {
    data.fwd_type = 'profile'
    im.forward(fwd_profile_to, data);
    fwd_profile_to = null
  }

  return true
}

const processHero = (data) => {
  if (!(data.content.includes(contents.hero) && data.content.includes(contents.battle))) {
    return false
  }

  hero.load(data.content)

  if (snd_coins_to) {
    im.send(snd_coins_to, settings.hero.contents.coins + hero.coins())
    snd_coins_to = false
  }

  if (data.content.includes(commands.level_up)) sendLevelUp();
  if (data.content.includes(commands.class)) sendClass();
  if (data.content.includes(commands.bath)) sendBath();

  hero.action()
  return true
}

const processInv = (data) => {
  if (data.content.includes(contents.inv)) {
    if (fwd_inv_to) {
      im.forward(fwd_inv_to, data)
      fwd_inv_to = null
    }

    hero.loadInv(data.content)
    return true
  }

  return false
}

const processCommands = (data) => {
  var cmd_list = parseCommands(data.content)
  var game_commands = []

  if (cmd_list == null) return false;

  for (var i = 0; i < cmd_list.length; i++) {
    for (var j = 0; j < contents.commands.length; j++) {
      if (cmd_list[i].startsWith(contents.commands[j])) {
        game_commands.push(cmd_list[i])
        break
      }
    }
  }

  if (game_commands.length > 0) {
    if (game_commands[0].match(/\/(use|bind|sell)/)) return false;

    var percents = data.content.match(/\d+%/g)

    if (percents == null || game_commands.length < 2) {
      if (game_commands[0].startsWith('/fight_')) master.forward(data);
      sendRandomCommand(game_commands)
    } else {
      // sendMaxPercentCommand(game_commands, percents)
      sendNotNullPercentCommand(game_commands, percents)
    }

    return true
  }

  return false
}

const processReport = (data) => {
  if (!data.content.includes(contents.report)) return false;
  data.fwd_type = 'report'
  fortressbot.forward(data)
  master.forward(data)
  return true
}

const processExchange = (data) => {
  if (data.content.includes(contents.exc_sale)) {
    master.forward(data)
    return true
  }

  var idx = data.content.search(contents.exchange)
  if (idx < 0) return false;

  var numbers = data.content.substr(idx).match(/\d+/g)
  exchange_slots = parseInt(numbers[1])

  if (flush_exchange_slots) {
    var cmds = data.content.substr(idx).match(/\/rm_[a-z\d]+/g)

    if (cmds) {
      for (var i = 0; i < cmds.length; i++) send(cmds[i]);
    }
    flush_exchange_slots = false
  }

  master.forward(data)
  return true
}

const processStock = (data) => {
  if (data.content.includes(contents.stock)) {
    banker.forward(data)
    master.forward(data)
    return true
  }
  return false;
}

const processSale = (data) => {
  if (!data.content.includes(contents.sale)) return false;

  var cmds = data.content.match('/wts_[_\d]+/g')
  if (cmds) {
    cmds =
      cmds.sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()))
    for (var i = 0; i < exchange_slots; i ++) send(cmds.pop());
  }
  return true
}

const processBuild = (data) => {
  for (let key in contents.build) {
    if (data.content.includes(contents.build[key])) {
      data.fwd_type = key
      fortressbot.forward(data)
      foremanbot.forward(data)
      master.forward(data)
      return true
    }
  }

  let percents = data.content.match(/\d+%/g)

  if (data.content.includes(contents.buildings)) {
    sendRandomOptCommand(parseCommands(data.content), percents, hero.options().build)
    return true
  }

  if (data.content.includes(contents.to_building)) {
    sendRandomOptCommand(parseCommands(data.content), percents, hero.options().repair)
    return true
  }

  return false
}

const processPrice = (data) => {
  if (!data.content.includes(contents.price)) return false;

  let numbers = data.content.match(/\d+/g)

  numbers.pop()
  let code = numbers.pop()

  logger.debug('game.processPrice: ' + code + ' ' + numbers[3])

  prices_cached[code] = {price: parseInt(numbers[3]), updated: Date.now()}
  master.forward(data)

  return true
}

const processors = [
  // detectCommand,
  processCastle,
  processProfile,
  processHero,
  processArena,
  processPrice,
  processExchange,
  processSale,
  // processStock,
  processReport,
  processInv,
  processBattle,
  processBuild,
  processCommands,
  processUnknown
]

const processMessage = (data) => {
  if (data.type != 'message') return false;
  if (manual_mode) return master.forward(data);

  logger.debug('game.processMessage: ' + data.content)

  wait_answer = false
  for (var i = 0; i < processors.length; i++) {
    if (processors[i](data)) {
      logger.debug('game.processMessage: processed with ' + processors[i].name)
      return true
    }
  }
  return false
}

const raid = (data) => {
  let cmd_list = parseCommands(data.content)
  master.forward(data)

  return cmd_list && hero.raid(cmd_list.pop())
}

const parseCommands = (content) => content.match(/\/[_a-z\d]+/g);

const canSend = (msg) => hero.sleepTill() < Date.now() && isCommand(msg);

const send = (msg) => {
  if (manual_mode) return im.send(chat_key, msg);
  if (canSend(msg)) return send_queue.push(msg);
  logger.debug('game.send: can\'t send message: ' + msg);
  return false
}

const sendCommand = (cmd, value) => {
  if (typeof commands[cmd] === 'object') {
    return sendRandomCommand(commands[cmd])
  } else if (typeof commands[cmd] !== 'undefined') {
    cmd = commands[cmd]
  }

  value = typeof value === 'undefined' ? '' : value
  return send(cmd + value)
}

const sendMaxPercentCommand = (commands, percents) => {
  var idx = 0, max = 0

  for (var i = 0; i < percents.length; i++) {
    var percent = parseInt(percents[i])
    if (percent > max && percent < 100) {
      max = percent
      idx = i
    }
  }

  send(commands[idx].match(/\/[_a-z]+/)[0])
}

const sendRandomOptCommand = (commands, percents, options) => {
  var cmd_list = []
  options = typeof options === 'undefined' ? {} : options

  for (var i = 0; i < percents.length; i++) {
    let percent = parseInt(percents[i])
    let target = commands[i].split('_').pop()
    if (options.indexOf(target) < 0 && castle_commands.indexOf(commands[i]) < 0) continue;
    if (percent < 100) cmd_list.push(commands[i]);
  }

  return cmd_list.length > 0 ? sendRandomCommand(cmd_list) : false
}

const sendRandomCommand = (cmd_list) => {
  if (cmd_list.length < 1) {
    logger.debug('game.sendRandomCommand: cmd_list: ' + JSON.stringify(cmd_list))
    return false
  }

  var idx = Math.floor(Math.random() * 100) % cmd_list.length
  var cmd = cmd_list[idx]

  logger.debug('game.sendRandomCommand: idx: ' + idx + ', cmd: ' + cmd)
  if (cmd.startsWith('/') && cmd.match(/\/(fight|on|off|wtb|rm|bind|use)/) == null) {
    cmd = cmd.match(/\/[_a-z]+/)[0]
  }

  return send(cmd)
}

const sendClass = () => {
  let opts, cmd

  if (hero.class() !== 'undefined') opts = settings.game.classes[hero.class()];

  if (opts === 'undefined') {
    logger.info('Can\'t find hero class in settings')
    return false
  }

  cmd = opts[hero.level().toString()]
  if (typeof cmd === 'undefined') cmd = 'education'

  logger.debug('game.sendClass: hero class ' + hero.class() + ' level ' + hero.level())
  logger.debug('game.sendClass: opts: ' + JSON.stringify(opts))
  logger.debug('game.sendClass: cmd: ' + cmd)
  send(commands.class)
  send(commands[cmd])
}

const sendBath = () => {
  send(commands.bath)
  setTimeout(stop, 5000)
}

const sendLevelUp = () => {
  let cmd = hero.isAttacker() ? 'up_attack' : 'up_defense'

  switch(hero.options().levelup) {
    case 'defense':
      cmd = 'up_defense'
    case 'attack':
      cmd = 'up_attack'
  }

  send(commands.level_up)
  send(commands[cmd])
}

var
  fwd_profile_to = null,
  fwd_inv_to = null,
  snd_coins_to = null

const forwardProfile = (chat) => {
  fwd_profile_to = chat
  send(commands.hero)
}

const showCoins = (chat) => {
  snd_coins_to = chat
  send(commands.show)
}

const forwardInv = (chat) => {
  fwd_inv_to = chat
  send(commands.inv)
}

const moveResToExchange = () => {
  send(commands.sale)
}

const moveResFromExchange = () => {
  flush_exchange_slots = true
  send(commands.exchange)
  setTimeout(() => flush_exchange_slots = false, 600000)
}

const cancelArena = () => {
  send(commands.cancel_arena)
}

const goArena = () => {
  send(commands.arena)
}

const quest = (key) => {
  send(commands[key])
}

const prices = (resource_codes) => {
  var load = false, res = {}

  logger.debug('game.prices: ' + JSON.stringify(prices_cached))

  for (let i = 0; i < resource_codes.length; i ++) {
    let code = resource_codes[i]

    if (typeof prices_cached[code] === 'undefined' || Date.now() - prices_cached[code].updated > 180000) {
      logger.debug('game.prices: load: ' + code + ' ' + JSON.stringify(prices_cached[code]))
      prices_cached[code] = {price: 0, updated: Date.now()}
      sendCommand('buy', code)
      load = true
    } else {
      res[code] = prices_cached[code].price
    }
  }

  return (load ? null : res)
}

const canWaitAnswer = (cmd) => {
  if (cmd.startsWith(commands.on)) return false;
  return true
}

const start = (key) => {
  if (typeof key !== 'undefined') chat_key = key;

  logger.debug('game.start: ' + chat_key)
  im.register(chat_key, processMessage)
  master.send('Game started')

  logger.debug('game.start: main_loop: ' + main_loop)
  if (typeof main_loop !== 'undefined') return main_loop;

  send_queue = []
  seafront = false

  return main_loop = setInterval(() => {
    if (minToBattle() > 238) restart();
    else restarted = false;

    if (wait_answer) {
      let offset = Date.now() - last_command_time
      if (offset > 3000 && offset < 4000) logger.debug('game main_loop: wait answer...');
      return
    }

    if (send_queue.length > 0) {
      logger.debug('game main_loop queue: ' + JSON.stringify(send_queue))
      last_command = send_queue.shift()
      last_command_time = Date.now()

      im.send(chat_key, last_command)
      wait_answer = canWaitAnswer(last_command)
    } else if (Date.now() - last_command_time > hero.stateTimeout()) {
      logger.debug('game main_loop: hero state timeout (' + hero.stateTimeout() / 1000 + 's)')
      send(commands.show)
    }
  }, 1000)
}

const restart = () => {
  if (restarted) return false;
  logger.debug('game.restart')
  restarted = true
  manual_mode = false
  stop()
  hero.reset()
  start()
}

const stop = () => {
  logger.debug('game.stop')
  im.unregister('game')
  main_loop = clearInterval(main_loop)
  send_queue = []

  if (new Date().getUTCHours() < battlehours[1]) {
    arena_results = []
  }

  im.reset()
  wait_answer = false
  master.send('Game stopped')
}

const manualMode = (mode) => {
 if (typeof mode !== 'undefined') manual_mode = mode;
 return manual_mode
}

module.exports = {
  arenaResults: () => arena_results.length > 0 ? arena_results : 'No arena results',
  cancelArena: cancelArena,
  forwardInv: forwardInv,
  forwardProfile: forwardProfile,
  goArena: goArena,
  info: info,
  isCommand: isCommand,
  manualMode: manualMode,
  minToBattle: minToBattle,
  moveResFromExchange: moveResFromExchange,
  moveResToExchange: moveResToExchange,
  quest: quest,
  prices: prices,
  processPrice: processPrice,
  raid: raid,
  restart: restart,
  seafront: () => seafront,
  sendCommand: sendCommand,
  sendRandomCommand: sendRandomCommand,
  showCoins: showCoins,
  start: start,
  stop: stop,
}
