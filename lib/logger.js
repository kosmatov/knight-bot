level = process.env.LOG_LEVEL || 2
hidtm = process.env.NODE_ENV == 'production'

const info = (msg, lvl, hidetime) => {
  debug(msg, lvl, hidetime)
  master.send(msg)
}

const debug = (msg, lvl, hidetime) => {
  if (typeof lvl === 'undefined') lvl = level;

  var dmsg = JSON.stringify(msg)
  dmsg = dmsg.substr(1, dmsg.length - 2)
  dmsg = dmsg.replace('\"', '"').replace('\n', ' ')

  if (lvl > 1 && lvl <= level) {
    if (typeof hidetime === 'undefined') {
      if (hidtm) {
        dmsg = '-- ' + dmsg
      } else {
        var d = new Date
        dmsg = d.toLocaleTimeString() + "\n" + dmsg
      }
    }
    console.log(dmsg)
  }
}

module.exports = {
  info: info,
  debug: debug,
  level: level
}
