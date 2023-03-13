/*
 * Copyright 2021-2023 mtripg6666tdr
 * 
 * This file is part of mtripg6666tdr/Discord-SimpleMusicBot. 
 * (npm package name: 'discord-music-bot' / repository url: <https://github.com/mtripg6666tdr/Discord-SimpleMusicBot> )
 * 
 * mtripg6666tdr/Discord-SimpleMusicBot is free software: you can redistribute it and/or modify it 
 * under the terms of the GNU General Public License as published by the Free Software Foundation, 
 * either version 3 of the License, or (at your option) any later version.
 *
 * mtripg6666tdr/Discord-SimpleMusicBot is distributed in the hope that it will be useful, 
 * but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with mtripg6666tdr/Discord-SimpleMusicBot. 
 * If not, see <https://www.gnu.org/licenses/>.
 */

import type { CommandArgs } from ".";
import type { CommandMessage } from "../Component/commandResolver/CommandMessage";

import { BaseCommand } from ".";
import { discordUtil } from "../Util";

export default class Rm extends BaseCommand {
  constructor(){
    super({
      name: "削除",
      alias: ["消去", "remove", "rm", "del", "delete"],
      description: "キュー内の指定された位置の曲を削除します。",
      unlist: false,
      category: "playlist",
      examples: "rm 5",
      usage: "削除 <削除する位置>",
      argument: [{
        type: "string",
        name: "index",
        description: "削除するインデックスはキューに併記されているものです。ハイフンを使って2-5のように範囲指定したり、スペースを使って1 4 8のように複数指定することも可能です。",
        required: true,
      }],
      requiredPermissionsOr: [],
      shouldDefer: false,
    });
  }

  async run(message: CommandMessage, context: CommandArgs){
    if(context.args.length === 0){
      message.reply("引数に消去する曲のオフセット(番号)を入力してください。").catch(this.logger.error);
      return;
    }
    if(context.args.includes("0") && context.server.player.isPlaying){
      message.reply("現在再生中の楽曲を削除することはできません。");
      return;
    }

    context.server.updateBoundChannel(message);

    const q = context.server.queue;
    const addition = [] as number[];
    
    // 引数についてるハイフン付きのオプションを展開する。
    // 5-、-12、3-6など。
    context.args.forEach(o => {
      let match = o.match(/^(?<from>[0-9]+)-(?<to>[0-9]+)$/);
      if(match){
        const from = Number(match.groups.from);
        const to = Number(match.groups.to);
        if(!isNaN(from) && !isNaN(to) && from <= to){
          for(let i = from; i <= to; i++){
            addition.push(i);
          }
        }
      }else{
        match = o.match(/^(?<from>[0-9]+)-$/);
        if(match){
          const from = Number(match.groups.from);
          if(!isNaN(from)){
            for(let i = from; i < q.length; i++){
              addition.push(i);
            }
          }
        }else{
          match = o.match(/^-(?<to>[0-9]+)$/);
          if(match){
            const to = Number(match.groups.to);
            if(!isNaN(to)){
              for(let i = context.server.player.isPlaying ? 1 : 0; i <= to; i++){
                addition.push(i);
              }
            }
          }
        }
      }
    });

    // 引数を通常の数字としても処理する
    const indexes = context.args.concat(addition.map(n => n.toString()));

    // 数字に変換した上で重複を削除して、削除するアイテムのインデックスを作成
    const dels = Array.from(
      new Set(
        indexes
          .map(str => Number(str))
          .filter(n => !isNaN(n))
          .sort((a, b) => b - a)
      )
    );

    // 実際に削除を実行
    const actualDeleted = [] as number[];
    const failed = [] as number[];
    let firstItemTitle = null;
    for(let i = 0; i < dels.length; i++){
      const item = q.get(dels[i]);
      if(
        discordUtil.users.isDJ(message.member, context)
        || item.additionalInfo.addedBy.userId === message.member.id
        || !discordUtil.channels.getVoiceMember(context).has(item.additionalInfo.addedBy.userId)
        || discordUtil.channels.isOnlyListener(message.member, context)
        || discordUtil.users.isPrivileged(message.member)
      ){
        // 権限等を確認して削除できるものなら削除
        q.removeAt(dels[i]);
        actualDeleted.push(dels[i]);
        if(actualDeleted.length === 1){
          firstItemTitle = item.basicInfo.title;
        }
      }else{
        // 削除失敗したインデックスを保存
        failed.push(dels[i]);
      }
    }

    if(actualDeleted.length > 0){
      // 実際削除できたものがあったのなら
      const title = actualDeleted.length === 1 ? firstItemTitle : null;
      const resultStr = actualDeleted.sort((a, b) => a - b).join(",");
      const failedStr = failed.sort((a, b) => a - b).join(",");
      message.reply(
        `🚮${resultStr.length > 100 ? "指定された" : `${resultStr}番目の`}曲${title ? "(`" + title + "`)" : ""}を削除しました`
        + `${
          failed.length > 0
            ? `\r\n:warning:${failed.length > 100 ? "一部" : `${failedStr}番目`}の曲は権限がないため削除できませんでした。`
            : ""
        }`
      ).catch(this.logger.error);
    }else{
      message.reply("削除できませんでした。権限が不足している可能性があります。").catch(this.logger.error);
    }
  }
}