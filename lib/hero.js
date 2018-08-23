const
  options = settings.hero.options,
  contents = settings.hero.contents,
  states = settings.hero.states,
  inv = settings.hero.inv

var
  hero = clone(settings.hero.profile),
  bath = false,
  inv_bag = [],
  arena_fights = 7,
  battle_target = null,
  search_enemy_start = null,
  report_sent = true,
  last_action = null,
  sleep_till = 0,
  raid_cmd = null,
  arena_info = ''

const actions = {
  raid: () => goRaid(),
  sleep: () => goSleep(),
  buyResources: () => buyResources(),
  buyUrgent: () => buyResources(),
  goSeafront: () => go('seafront', 'attack'),
  goCave: () => go('cave', 'mining'),
  goKorovan: () => go('korovan', 'mining'),
  goArena: () => goArena(),
  goForest: () => go('forest', 'mining'),
  goBuild: () => send('castle') && go('build'),
  goRepair: () => send('castle') && go('repair')
}

const canDoIt = {
  goBattle: game.minToBattle() < options.battle_threshold,
  raid: (chnc, hour) => raid_cmd,
  sleep: (chnc, hour) => options.sleep && !isBusy() && (hour > 22 || hour < 2) && hero.stamina < 2 && game.minToBattle() > 60,
  buyResources: (chnc, hour) => hero.coins > options.max_coins && hero.level > 9 && game.prices(options.buy),
  buyUrgent: (chnc, hour) => hero.coins > options.max_donate && game.minToBattle() < 40 && hero.level > 9 && game.prices(options.buy),
  goCave: (chnc, hour) => !isBusy() && last_action != 'goCave' && hero.stamina > 1 && chnc < options.cave_chance && hero.level > 6,
  goKorovan: (chnc, hour) => !isBusy() && hero.stamina > 1 && (hour > 21 || hour < 4) && chnc > 100 - options.korovan_chance,
  goArena: (chnc, hour) => options.arena && !isBusy() && last_action != 'cancelArena' && hero.coins > 4 && hour > 6 && hour < 21 && hero.level > 4 && arena_fights > 0 && game.minToBattle() > 20,
  goSeafront: (chnc, hour) => !isBusy() && game.seafront() && chnc > 100 - options.seafront_chance && hero.stamina > 0 && hero.level > 14,
  goForest: (chnc, hour) => !isBusy() && chnc < options.forest_chance && hero.stamina > 1,
  goRepair: (chnc, hour) => !isBusy() && hero.level > 9 && chnc < 50 && !(hero.level > 14 && game.seafront()),
  goBuild: (chnc, hour) => !isBusy() && hero.level > 9 && chnc > 49 && !(hero.level > 14 && game.seafront()),
}

const reset = () => {
  inv_bag = []
  report_sent = false
  battle_target = hero.flag
  arena_fights = 7
}

const action = () => {
  logger.debug('hero.action')

  if (inv_bag.length == 0) send('inv');
  if (!report_sent) report();

  logger.debug('hero.action: hero.state: ' + hero.state)

  if (inBattle() && game.minToBattle() > options.battle_threshold) {
    logger.debug('hero.action: minutes to battle: ' + game.minToBattle())
    relax()
  }

  if (isBusy() && arenaTimeout()) cancelArena();

  var hour = new Date().getUTCHours()
  var chance = Math.floor(Math.random() * 100)
  logger.debug('hero.action: chance ' + chance + ' hour ' + hour)

  for (let key in actions) {
    if (canDoIt[key](chance, hour)) {
      logger.debug('hero.action: ' + key)
      last_action = key
      return actions[key]()
    }
  }
}

const relax = () => {
  logger.debug('hero.relax')
  hero.state = states.relax
}

const isBusy = () => hero.state != states.relax;
const inBattle = () => hero.state == states.defense || hero.state == states.attack;
const inArena = () => hero.state == states.arena;

const send = (cmd, value, timeout) => game.sendCommand(cmd, value, timeout);
const buy = (res, count) => send('buy', res);
const on = (thing) => send('on', thing);

const go = (cmd, equipment) => {
  hero.state = states[cmd]
  if (typeof equipment !== 'undefined' ) equip(equipment);
  return send(cmd)
}

const sortedPrices = () => {
  var prices = game.prices(options.buy),
      res_prices = [],
      res = {}

  if (!prices) return null;

  for (let key in prices) res_prices.push([key, prices[key]]);
  return res_prices.sort((a, b) => b[1] - a[1])
}

const buyResources = () => {
  var prices = sortedPrices()

  if (!prices) return false;
  logger.debug('hero.buyResources: ' + JSON.stringify(prices))

  for (let i = 0; i < prices.length; i ++) {
    if (hero.coins > prices[i][1] && prices[i][1] > 0) {
      let count = Math.floor(hero.coins / prices[i][1])
      hero.coins -= count * prices[i][1]
      return buy(prices[i][0] + '_' + count)
    }
  }
}

const goRaid = () => {
  send(raid_cmd)
  raid_cmd = null
}

const raid = (cmd) => {
  raid_cmd = cmd
  send('show')
  setTimeout(() => send('show'), 3 * 60 * 1000)
  return true
}

const goSleep = () => {
  hero.state = states.sleep
  sleep_till = Date.now() + (game.minToBattle() - 28) * 60000
  logger.info('Sleep: ' + (game.minToBattle() - 28) + ' minutes')
}

const parse = function(data, startsub, pattern) {
  pattern = typeof pattern === 'undefined' ? /\d+/ : pattern
  str = typeof startsub === 'undefined' ? data : data.substr(data.search(startsub))
  res = str.match(pattern)
  return res && res[0]
}

const findSub = (data, sub_list, offset) => {
  var str = typeof offset === 'undefined' ? data : data.substr(offset)
  for (let key in sub_list) {
    if (str.search(sub_list[key]) > -1) {
      return sub_list[key]
    }
  }
}

const loadProfile = (data) => {
  if (hero.flag.length == 0) hero.flag = findSub(data, settings.game.flags) || '';

  if (data.includes(settings.game.commands.bath)) bath = true;
  else bath = false;

  var keys = Object.keys(hero)
  for (let i = 2; i < keys.length; i++) {
    if (keys[i] == 'exp') continue;
    hero[keys[i]] = parseInt(parse(data, contents[keys[i]]))
  }

  hero.exp = parse(data, contents.exp, /\d+\/\d+/)
  if (data.includes(contents.state)) {
    hero.state = findSub(data, states, data.search(contents.state))
  }
}

const klassName = () => {
  if (hero.level < 5) return '';

  var key
  for (num in settings.game.classes[klass()]) {
    if (parseInt(num) > hero.level) break;
    key = num
  }

  key = settings.game.classes[klass()][key]
  return key === 'undefined' ? '' : settings.game.commands[key].split(' ')[1]
}

const info = () => {
  var keys = Object.keys(hero),
      log = hero.flag + ' ' + klassName() + "\n"
  for (var i = 2; i < keys.length; i ++) {
    log += contents[keys[i]] + ' ' + hero[keys[i]] + ((i % 2) > 0 || i < 3 ? "\n" : ' ')
  }

  return log + hero.state + ' ' + (inBattle() ? battle_target : '')
}

const loadArenaFights = (data) => {
  var numbers = data.match(/\d+/g)
  numbers.pop()
  arena_fights = parseInt(numbers[2]) - parseInt(numbers[1])
  logger.debug('hero.loadArenaFights: ' + numbers.join('/'))
  arena_info = data.split("\n").slice(1, 3).join("\n")
}

const loadInv = (data) => {
  var cmd_list = data.match(/\w_\d+/g) || []
  inv_bag = []

  for (let i = 0; i < cmd_list.length; i++) {
    let number = parseInt(cmd_list[i].split('_').pop())
    if (number > 99) inv_bag.push(number);
  }

  logger.debug('hero.loadInv: ' + inv_bag.join(', '))
}

const goArena = () => {
  hero.state = states.arena
  equip('attack')
  search_enemy_start = null
  game.goArena()
}

const cancelArena = () => {
  game.cancelArena()
  last_action = 'cancelArena'
}

const arenaTimeout = () => {
  if (inArena() && Date.now() - search_enemy_start > stateTimeout()) return true;
  return false
}

const searchEnemy = () => {
  search_enemy_start = Date.now()
  send('search_enemy')
}

const arenaAttack = () => {
  search_enemy_start = null
  game.sendCommand('arena_attack')
  game.sendCommand('arena_defense')
}

const equip = (equipment) => {
  if (typeof inv[equipment + '_1'] == 'undefined') {
    logger.debug('hero.equip: can\'t equip "' + equipment + '"')
    return false
  }

  var inv_list = inv[equipment + '_1']
  for (let i = 0; i < inv_list.length; i++) {
    if (canInv(inv_list[i])) {
      on(inv_list[i])
      break
    }
  }

  inv_list = inv[equipment + '_2']
  if (typeof inv_list === 'undefined') return true;

  for (let i = 0; i < inv_list.length; i++) {
    if (canInv(inv_list[i])) {
      on(inv_list[i])
      break
    }
  }

  return true
}

const canInv = (inv) => inv_bag.indexOf(inv) > -1;

const goBattle = () => {
  logger.debug('hero.goBattle')

  hero.state = states.defense

  if (hero.coins > options.max_donate) logger.info(settings.game.alerts.coins);
  else if (hero.coins > 0 && hero.level > 7) {
    logger.debug('hero.goBattle: donate ' + hero.coins)
    send('donate', hero.coins);
  }

  battle_target = battle_target ? battle_target : hero.flag
  send(battle_target == hero.flag ? 'defense' : 'attack')
  logger.debug('hero.goBattle: send target flag: ' + battle_target)
  send(battle_target)

  fortressbot.updateProfile()
  fortressbot.regToBattle()

  if (hero.level > 9) {
    hideResources()
    setTimeout(tradebot.show, 600000)
  }
}

const hideResources = () => {
  game.moveResFromExchange()

  for (let i = 0; i < options.hide.length; i ++) {
    setTimeout(() => {
      logger.debug('hero.hideResources: move ' + options.hide[i])
      setTimeout(() => game.exchangeAddResource(options.hide[i]), 60000 + i * 5000)
    }, i * 5000 + 100)
  }
}

const battleTarget = (target) => {
  if (target == battle_target) return battle_target;

  if (typeof target !== 'undefined') {
    battle_target = target
    if (inBattle()) {
      if (target == hero.flag) send('defense');
      else send('attack');
      send(battle_target);
    }
  }

  master.send(hero.flag + settings.master.flag_sep + battle_target)
  return battle_target
}

const setOption = (key, value) => {
  if (typeof options[key] === 'undefined') {
    logger.debug('Undefined option: ' + key)
    return null
  }

  logger.debug('hero.setOption: ' + key + ' type "' + typeof options[key] + '" value "' + value + '"')

  switch (typeof options[key]) {
    case 'object':
      if (typeof value !== 'object') value = [value];

      var remove = false

      if (!(value[0].startsWith('+') || value[0].startsWith('-'))) options[key] = [];

      for (let i = 0; i < value.length; i++) {
        let opt = value[i].trim()

        if (opt.startsWith('+')) {
          remove = false
          opt = opt.slice(1)
        } else if (opt.startsWith('-')) {
          remove = true
          opt = opt.slice(1)
        }

        if (opt.length < 1) continue;

        if (remove) {
          let idx = options[key].indexOf(opt)
          if (idx > -1) options[key].splice(idx, 1);
        } else {
          options[key].push(opt)
        }
      }
      break
    case 'string':
      options[key] = value
      break
    case 'number':
      options[key] = parseInt(value)
      break
    case 'boolean':
      options[key] = JSON.parse(value)
  }

  fs.writeFileSync(options_path, JSON.stringify({hero: {options: options}}))
  return clone(options)
}

const goAttack = () => {
  hero.state = states.attack
  equip('attack')
}

const goDefense = () => {
  hero.state = states.defense
  equip('defense')
}

const klass = () => settings.hero.class;
const isAttacker = () => klass() == 'knight';

const stateTimeout = () => {
  if (game.minToBattle() < options.battle_threshold) return 5 * 60 * 1000;

  switch (hero.state) {
    case states.arena:
      return 30 * 60 * 1000
  }
  return 5 * 60 * 1000 + Math.floor(Math.random() * 100000)
}

const report = () => {
  logger.debug('hero.report: report sent: ' + report_sent)
  if (report_sent) return false;
  report_sent = true
  send('report')
  tradebot.show()
}

module.exports = {
  action: action,
  arenaAttack: arenaAttack,
  arenaFights: () => arena_fights,
  arenaInfo: () => arena_info.length > 0 ? arena_info : 'No arena data',
  battleTarget: battleTarget,
  buyResources: buyResources,
  options: () => clone(options),
  class: klass,
  coins: () => hero.coins,
  flag: () => hero.flag,
  hideResources: hideResources,
  goAttack: goAttack,
  goDefense: goDefense,
  inArena: inArena,
  inBattle: inBattle,
  info: info,
  isAttacker: isAttacker,
  isBusy: isBusy,
  level: () => hero.level,
  load: loadProfile,
  loadArenaFights: loadArenaFights,
  loadInv: loadInv,
  prices: sortedPrices,
  raid: raid,
  reset: reset,
  searchEnemy: searchEnemy,
  searchEnemyStart: () => search_enemy_start,
  setOption: setOption,
  sleepTill: () => sleep_till,
  stateTimeout: stateTimeout,
}
