import { common } from "../../model/index.js"
import { sleep } from "../../tools/index.js"

let FriendsReg = /^#(\d*)\s?发好友\s?(\d+)\s?([^]*)$/
let GroupMsgReg = /^#(\d*)\s?发群聊\s?(\d+)\s?([^]*)$/
let GroupListMsgReg = /^#发群列表\s?(\d+(,\d+){0,})\s?([^]*)$/

export class SendMsg extends plugin {
  constructor() {
    super({
      name: "椰奶助手-发消息",
      event: "message",
      priority: -1,
      rule: [
        {
          reg: FriendsReg, // 发好友
          fnc: "sendFriendMsg"
        },
        {
          reg: GroupMsgReg, // 发群聊
          fnc: "sendGroupMsg"
        },
        {
          reg: GroupListMsgReg, // 发群列表
          fnc: "sendGroupListMsg"
        }
      ]
    })
  }

  get Bot() {
    return this.e.bot ?? Bot
  }

  /**
   * 发好友
   * @param e
   */
  async sendFriendMsg(e) {
    if (!common.checkPermission(e, "master")) return

    let regRet = FriendsReg.exec(e.msg)

    let botId = regRet[1]
    let qq = regRet[2]
    e.message[0].text = regRet[3]

    let bot
    if (botId) {
      if (!Bot[botId]) return e.reply("❎ Bot账号错误")
      bot = Bot[botId]
    } else {
      bot = this.Bot
    }

    if (!/^\d+$/.test(qq)) return e.reply("❎ QQ号不正确，人家做不到的啦>_<~")

    if (!e.message[0].text) e.message.shift()

    if (!bot.fl.get(Number(qq))) return e.reply("❎ 好友列表查无此人")

    if (e.message.length === 0) {
      e._qq = qq
      e._bot = bot
      this.setContext("_sendFriendMsgContext")
      e.reply("⚠ 请发送需要发送的消息\n可发送‘#取消’进行取消")
      return
    }

    await bot.pickFriend(qq).sendMsg(e.message)
      .then(() => e.reply(`✅ ${qq} 私聊消息已送达`))
      .catch(err => common.handleException(e, err, { MsgTemplate: "❎ 发送失败\n错误信息为:{error}" }))
  }

  async _sendFriendMsgContext(e) {
    if (this.e.msg === "#取消") {
      this.finish("_sendFriendMsgContext")
      return this.e.reply("✅ 已取消")
    }
    const { _bot, _qq } = e
    _bot.pickFriend(_qq).sendMsg(this.e.message)
      .then(() => this.e.reply(`✅ ${_qq} 私聊消息已送达`))
      .catch(err => common.handleException(this.e, err, { MsgTemplate: "❎ 发送失败\n错误信息为:{error}" }))
    this.finish("_sendFriendMsgContext")
  }

  /**
   * 发群聊
   * @param e
   */
  async sendGroupMsg(e) {
    if (!common.checkPermission(e, "master")) return

    let regRet = GroupMsgReg.exec(e.msg)

    let botId = regRet[1]
    let gpid = regRet[2]
    e.message[0].text = regRet[3]

    let bot
    if (botId) {
      if (!Bot[botId]) return e.reply("❎ Bot账号错误")
      bot = Bot[botId]
    } else {
      bot = this.Bot
    };

    if (!/^\d+$/.test(gpid)) return e.reply("❎ 群号不合法")

    if (!e.message[0].text) e.message.shift()

    if (!bot.gl.get(Number(gpid))) return e.reply("❎ 群聊列表查无此群")

    if (e.message.length === 0) {
      e._gpid = gpid
      e._bot = bot
      this.setContext("_sendGroupMsgContext")
      e.reply("⚠ 请发送需要发送的消息\n可发送‘#取消’进行取消")
      return
    }

    await bot.pickGroup(gpid).sendMsg(e.message)
      .then(() => e.reply(`✅ ${gpid} 群聊消息已送达`))
      .catch((err) => common.handleException(e, err, { MsgTemplate: "❎ 发送失败\n错误信息为:{error}" }))
  }

  async _sendGroupMsgContext(e) {
    if (this.e.msg === "#取消") {
      this.finish("_sendGroupMsgContext")
      return this.e.reply("✅ 已取消")
    }
    const { _bot, _gpid } = e
    await _bot.pickGroup(_gpid).sendMsg(this.e.message)
      .then(() => this.e.reply(`✅ ${_gpid} 群聊消息已送达`))
      .catch((err) => common.handleException(this.e, err, { MsgTemplate: "❎ 发送失败\n错误信息为:{error}" }))
    this.finish("_sendGroupMsgContext")
  }

  /**
   * 发群列表
   * @param e
   */
  async sendGroupListMsg(e) {
    if (!common.checkPermission(e, "master")) return

    let regRet = GroupListMsgReg.exec(e.msg)
    let gpid = regRet[1]
    e.message[0].text = regRet[3]

    if (!e.message[0].text) e.message.shift()

    if (e.message.length === 0) return e.reply("❎ 消息不能为空")

    let groupidList = []
    let sendList = []

    let listMap = Array.from(this.Bot.gl.values())

    listMap.forEach((item) => {
      groupidList.push(item.group_id)
    })

    let groupids = gpid.split(",")

    if (!groupids.every(item => item <= groupidList.length)) return e.reply("❎ 序号超过合法值！！！")

    groupids.forEach((item) => {
      sendList.push(groupidList[Number(item) - 1])
    })

    if (sendList.length > 3) return e.reply("❎ 不能同时发太多群聊，号寄概率增加！！！")

    if (sendList.length === 1) {
      await this.Bot.pickGroup(sendList[0]).sendMsg(e.message)
        .then(() => e.reply("✅ " + sendList[0] + " 群聊消息已送达"))
        .catch((err) =>
          common.handleException(e, err, { MsgTemplate: `❎ ${sendList[0]} 发送失败\n错误信息为:{error}` })
        )
    } else {
      e.reply("发送多个群聊，将每5秒发送一条消息！")
      for (let i of sendList) {
        await this.Bot.pickGroup(i).sendMsg(e.message)
          .then(() => e.reply("✅ " + i + " 群聊消息已送达"))
          .catch((err) =>
            common.handleException(e, err, { MsgTemplate: `❎ ${i} 发送失败\n错误信息为:{error}` }))
        await sleep(5000)
      }
    }
    return false
  }
}
