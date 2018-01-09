require('../config/boot')
const fs = require('fs')

logger.level = 0
global.assert = require('assert')

global.fixture = (path) => {
  var spath = path.split('.')
  var filename = spath.pop()
  spath.unshift('fixtures')
  spath.unshift(__dirname)

  var dir = spath.join('/')
  var files = fs.readdirSync(dir)

  for (var i = 0; i < files.length; i++) {
    var [name, ext] = files[i].split('.')

    if (name == filename) {
      var content = fs.readFileSync(dir + '/' + files[i])
      if (ext == 'txt') return content.toString();
      else return JSON.parse(content)
    }
  }
}

im.start()
