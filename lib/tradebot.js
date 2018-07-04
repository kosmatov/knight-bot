const
  commands = settings.tradebot.commands,
  message = settings.tradebot.messages,
  contents = settings.tradebot.contents

var
  chat_key = '',
  last_command_time = 0,
  in_process = true

const sendCommands = (commands) => {
  im.send(chat_key, commands)
  last_command_time = Date.now()
}

const processResources = (content) => {
  in_process = true

  var
    numbers = content.match(/\d+/g),
    cmd_list = [],
    trade_skip = hero.options().trade_skip

  if (trade_skip[0] == 'all') return false;

  for (var i = 0; i < numbers.length; i += 2) {
    var num = parseInt(numbers[i])

    for (let j = 0; j < trade_skip.length; j ++) {
      let
        snums = trade_skip[j].split('-'),
        min = parseInt(snums[0]),
        max = parseInt(snums.length < 2 ? snums[0] : snums[1])

      if (num >= min  && num <= max) continue;

      cmd_list.push(commands.add + num + ' ' + numbers[i + 1])
    }
  }

  sendCommands(cmd_list)
}

const sendResources = (data) => {
}

const processMessage = (data) => {
  if (data.type != 'message') {
    if (data.content.includes(contents.more)) {
      in_process = false
    } else return false;
  }

  if (data.content.includes(contents.change)) in_process = false;

  if (data.content.includes(contents.resources)) {
    if (in_process) {
      if (!data.content.includes(contents.what_you_get)) {
        master.forward(data)
        banker.forward(data)
      }
      return false
    }

    var start = data.content.search(contents.resources)
    var end = data.content.search(contents.deal)

    if (end < 0) end = data.content.length;

    processResources(data.content.substr(start, end))
  } else if (data.content.includes(contents.send)) {
    sendResources(data)
  }
}

const show = () => {
  if (typeof chat_key === 'undefined') return false;
  in_process = true
  im.send(chat_key, commands.start)
}

const start = (key) => {
  chat_key = key
  logger.debug('tradebot.start: ' + key)
  im.register(key, processMessage)
}

module.exports = {
  show: show,
  start: start
}
