var started = false
    chats = {},
    consumers = {},
    msg_queue = []

const chat_keys = Object.keys(settings.im.chats)

const onAddChat = (key) => {
  let chat = settings.im.chats[key]
  if (typeof global[chat.type] !== 'undefined' && typeof global[chat.type].start === 'function') {
    global[chat.type].start(key)
  }
}

const chatExists = (chat) => typeof chats[chat] !== 'undefined';
const register = (chat, callback) => consumers[chat] = callback;
const unregister = (chat) => consumers[chat] = undefined;
const tdName = (chat_key) => settings.im.chats[chat_key].name.replace(/\s/g, '_');

const chatKey = (name) => {
  var key = null

  for (var i = 0; i < chat_keys.length; i++) {
    let chat_name = settings.im.chats[chat_keys[i]].name
    if (typeof chat_name === 'undefined') {
      logger.info('Undefined chat name for ' + chat_keys[i] + "\n Stop bot");
      setTimeout(stop, 5000)
    }
    else if (name.startsWith(chat_name)) key = chat_keys[i];
  }

  return key
}

const updateChat = (data) => {
  var key = chatKey(data.name)
  if (key && typeof chats[key] === 'undefined') {
    logger.debug('Register chat: ' + settings.im.chats[key].name)
    data.td_name = tdName(key)
    chats[key] = data
    msg_queue.push('history ' + data.td_name + ' 1')
    return setTimeout(() => onAddChat(key), 10000)
  }
}

const receiveMessage = (data) => {
  if (!started) return false;

  data.chat_key = chatKey(data.chat)
  if (typeof data.chat_key !== 'undefined' && typeof consumers[data.chat_key] !== 'undefined') {
    return consumers[data.chat_key](data)
  }

  return false
}

const send = (chat, messages) => {
  if (typeof messages != 'object') messages = [messages];

  if (!chatExists(chat)) {
    logger.info('im.send: can\'t send to undefined chat "' + chat + '"')
    return false
  }

  for (var i = 0; i < messages.length; i++) {
    queue('msg ' + chats[chat].td_name + ' ' + JSON.stringify(messages[i]))
  }
}

const forward = (chat, data) => {
  if (!chatExists(chat)) {
    logger.info('im.forward: can\'t fwd to undefined chat "' + chat + '"')
    return false
  }

  let id = typeof data == 'object' ? data.id : data
  queue('fwd ' + chats[chat].td_name + ' ' + id)
}

const push = (data, button) => {
  queue('push_button ' + data.id + ' ' + button)
}

const queue = (msg) => msg_queue.push(msg);

const pin = (data) => {
  msg_queue.push('pin ' + data.id)
}

const receivers = {
  message: receiveMessage,
  command: receiveMessage,
  chat: updateChat,
}

const receiveData = (data) => {
  if (typeof receivers[data.type] !== 'undefined') return receivers[data.type](data);
  logger.debug(data)
  return null
}

const start = (tdcli) => {
  logger.debug('IM started')
  started = true

  msg_queue.push('dialog_list 50')

  return setInterval(() => {
    msg_queue.length > 0 && tdcli.msg(msg_queue.shift())
  }, 500)
}

const stop = () => started = false;
const reset = () => msg_queue = [];

module.exports = {
  start: start,
  stop: stop,
  pin: pin,
  push: push,
  chats: () => chats,
  send: send,
  forward: forward,
  queue: queue,
  reset: reset,
  exists: chatExists,
  receive: receiveData,
  register: register,
  unregister: unregister,
}
