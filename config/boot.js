global.lib_path    = root_path + '/lib'

const deepmerge    = require('deep-extend')
global.fs          = require('fs')
global.clone       = require('lodash.clonedeep')
global.util        = require('util')

global.profile     = process.env.PROFILE
global.profile_settings_path = __dirname + '/settings.' + profile + '.json'
global.options_path = __dirname + '/profiles/' + profile + '.json'

let default_settings = JSON.parse(fs.readFileSync(__dirname + '/settings.default.json'))
let current_settings =
  fs.existsSync(__dirname + '/settings.json') ? JSON.parse(fs.readFileSync(__dirname + '/settings.json')) : {}
let profile_settings =
  fs.existsSync(profile_settings_path) ? JSON.parse(fs.readFileSync(profile_settings_path)) : {}
let options =
  fs.existsSync(options_path) ? JSON.parse(fs.readFileSync(options_path)) : {}

global.settings = deepmerge(default_settings, current_settings, profile_settings, options)

global.im          = require(lib_path + '/im'),
global.game        = require(lib_path + '/game'),
global.hero        = require(lib_path + '/hero'),
global.logger      = require(lib_path + '/logger'),
global.fortressbot = require(lib_path + '/fortressbot'),
global.tradebot    = require(lib_path + '/tradebot'),
global.groupchat   = require(lib_path + '/groupchat')
global.banker      = require(lib_path + '/banker')
global.master      = require(lib_path + '/master')
global.telegram    = require(lib_path + '/telegram')
global.raidboss    = require(lib_path + '/raidboss')
global.foremanbot  = require(lib_path + '/foremanbot')
