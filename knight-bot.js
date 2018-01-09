global.root_path = __dirname
global.time_start = Date.now()

require('./config/boot')

const
  net           = require('net'),
  readline      = require('readline'),
  child_process = require('child_process')

const tdcmd = __dirname + '/bin/telegram-cli'
const tdlog = __dirname + '/log/' + 'tdcli-' + profile + '.log'
const tdarg = ['-DRCW', '-p', profile, '-L', tdlog]

const tdcli = {
  msg: (msg) => {
    logger.debug('=> ' + msg, 2, 1)
    child.stdin.write(msg + "\n")
  }
}

const parseDialog = (buffer) => {
  var data = buffer.shift().split(' ')
  data.shift()
  return {
    type: 'chat',
    name: data.join(' ')
  }
}

const parseMessage = (buffer) => {
  var sep  = ' >>> ', type = 'message'
  var data = buffer.shift().split(sep)

  if (data.length < 2) {
    sep = ' <<< '
    data = data[0].split(sep)
    if (data.length < 2) return false;
    type = 'command'
  }

  var meta = data.shift().split(/\s+/)
  buffer.unshift(data.join(sep))

  return {
    type: type,
    time: meta.shift().substr(1, 5),
    id: meta.shift(),
    chat: meta.join(' ').trim(),
    content: buffer.join("\n")
  }
}

const parse = (buffer) => {
  switch (bufferType(buffer[0])) {
    case 'message':
      return parseMessage(buffer)
    case 'chat':
      return parseDialog(buffer)
  }
}

const msg_marks = {
  message: /^\[\d{2}:\d{2}\]/,
  chat: /^Dialog/
}

var rl_buffer = [],
    ms_buffer = [],
    ms_buffer_flush = false,
    ms_buffer_lock = false

const bufferType = (line) => {
  for (let key in msg_marks) {
    if (line.match(msg_marks[key])) return key;
  }
}

const flushBuffer = (buffer) => {
  let data = parse(buffer)
  if (data) im.receive(data);
  return []
}

const msBufferFlush = () => {
  ms_buffer = flushBuffer(ms_buffer)
  ms_buffer_flush = false
}

const rlBufferRead = () => {
  if (ms_buffer_lock) return;

  if (rl_buffer.length > 0) {
    while (line = rl_buffer.shift()) {
      if ((ms_buffer.length > 0) && bufferType(line)) msBufferFlush();
      ms_buffer.push(line)
    }
  } else if (ms_buffer_flush) {
    msBufferFlush()
  } else if (ms_buffer.length > 0) {
    ms_buffer_flush = true
  }
}

const readLine = (line) => {
  logger.debug('<= ' + line, 3, 1)
  ms_buffer_flush = false
  rl_buffer.push(line)
}

const child = child_process.spawn(tdcmd, tdarg)

const rl = readline.createInterface({
  input: child.stdout
})

rl.on('line', readLine)
rl.on('close', () => {
  logger.debug('Readline closed', 2, 1)
  process.exit(0)
})

setTimeout(() => {
  im.start(tdcli)
  setInterval(rlBufferRead, 500)
}, 60000 + Math.floor(Math.random() * 100000))
