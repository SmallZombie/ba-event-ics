import { join } from '@std/path';
import { timeout, Vcalendar, VcalendarBuilder, Vevent } from './src/BaseUtil.ts';
import { getCNAllEvents, getEventDetail, getGLAllEvents, getJPAllEvents } from './src/WikiController.ts';
import { ReleaseJsonType } from './src/type/ReleaseJsonType.ts';
import { UID_PREFIX } from './src/Const.ts';
import { existsSync } from '@std/fs/exists';
import { ServerEnum } from './src/enum/ServerEnum.ts';
import { CNEventType } from './src/type/CNEventType.ts';


function getICS(server: ServerEnum): Vcalendar {
    const path = join(Deno.cwd(), `release${server}.ics`);
    if (existsSync(path)) {
        return Vcalendar.fromString(Deno.readTextFileSync(path));
    } else {
        const builder = new VcalendarBuilder();
        const vcalendar: Vcalendar = builder
            .setVersion('2.0')
            .setProdId('-//SmallZombie//BA Event ICS//ZH')
            .setName('蔚蓝档案活动')
            .setRefreshInterval('P1D')
            .setCalScale('GREGORIAN')
            .setTzid('Asia/Shanghai')
            .setTzoffset('+0800')
            .build();
        return vcalendar;
    }
}

function getJson(server: ServerEnum): ReleaseJsonType {
    const path = join(Deno.cwd(), `release${server}.json`);
    if (existsSync(path)) {
        return JSON.parse(Deno.readTextFileSync(path)) as ReleaseJsonType;
    } else {
        return [];
    }
}

async function main(server: ServerEnum) {
    console.log(`[***] Running At "${server}"`);
    const ics = getICS(server);
    let json = getJson(server);
    const events = await (() => {
        switch (server) {
            case ServerEnum.GL: return getGLAllEvents();
            case ServerEnum.JP: return getJPAllEvents();
            case ServerEnum.CN: return getCNAllEvents();
            default: throw new Error(`Invalid server: "${server}"`);
        }
    })();

    let needSaveJSON = false;
    // 去除 ics 和 json 的无效数据
    ics.items = ics.items.filter(v => {
        if (!events.some(vv => UID_PREFIX + vv.id === v.uid)) {
            console.log(`[!] Remove "${v.summary}"(${v.uid}) in ICS`);
            return false;
        }
        return true;
    });
    json = json.filter(v => {
        if (!events.some(vv => vv.id === v.id)) {
            console.log(`[!] Remove "${v.name}"(${v.id}) in JSON`);
            needSaveJSON = true;
            return false;
        }
        return true;
    });

    console.log('[!] Total Events:', events.length);
    for (let i = 0; i < events.length; i++) {
        const item = events[i];

        const { start, end } = await (() => {
            switch (server) {
                case ServerEnum.GL: return getEventDetail(ServerEnum.GL, item.slug, item.feature);
                case ServerEnum.JP: return getEventDetail(ServerEnum.JP, item.slug, item.feature);
                case ServerEnum.CN: return {
                    start: (item as CNEventType).start,
                    end: (item as CNEventType).end
                };
            }
        })();
        const dtstart = ics.dateToDateTime(start);
        const dtend = ics.dateToDateTime(end);

        let icsItem = ics.items.find(v => v.uid === UID_PREFIX + item.id);
        if (!icsItem) {
            icsItem = new Vevent(UID_PREFIX + item.id, ics.dateToDateTime(new Date()), dtstart);
            ics.items.push(icsItem);
        }
        icsItem.dtstart = dtstart;
        icsItem.dtend = dtend;
        icsItem.summary = item.name;
        icsItem.description = item.description;
        if (icsItem.hasChanged) {
            console.log(`${i + 1}/${events.length} Update "${item.name}"(${item.id}) in ICS`);
        }

        const jsonItem = json.find(v => v.id === item.id);
        if (jsonItem) {
            if (jsonItem.start !== start.toISOString()) {
                console.log(`${i + 1}/${events.length} Update "${item.name}"(${item.id}) start field in JSON. (${jsonItem.start} -> ${start.toISOString()})`);
                jsonItem.start = start.toISOString();
                needSaveJSON = true;
            }
            if (jsonItem.end !== end.toISOString()) {
                console.log(`${i + 1}/${events.length} Update "${item.name}"(${item.id}) end field in JSON. (${jsonItem.end} -> ${end.toISOString()})`);
                jsonItem.end = end.toISOString();
                needSaveJSON = true;
            }
            if (jsonItem.description !== item.description) {
                console.log(`${i + 1}/${events.length} Update "${item.name}"(${item.id}) description field in JSON. (${jsonItem.description} -> ${item.description})`);
                jsonItem.description = item.description;
                needSaveJSON = true;
            }
        } else {
            console.log(`${i + 1}/${events.length} Add "${item.name}"(${item.id}) to JSON`);
            json.push({
                id: item.id,
                name: item.name,
                start: start.toISOString(),
                end: end.toISOString(),
                description: item.description ? item.description : void 0
            });
            needSaveJSON = true;
        }

        if (server !== ServerEnum.CN) {
            await timeout(200);
        }
    }

    const needSaveICS = ics.items.some(v => v.hasChanged);
    if (needSaveICS) {
        const icsSavePath = join(Deno.cwd(), `release${server}.ics`);
        Deno.writeTextFileSync(icsSavePath, ics.toString());
        console.log(`[√] ICS Has Save To "${icsSavePath}"`);
    }

    if (needSaveJSON) {
        const jsonSavePath = join(Deno.cwd(), `release${server}.json`);
        Deno.writeTextFileSync(jsonSavePath, JSON.stringify(json, null, 4));
        console.log(`[√] JSON Has Save To "${jsonSavePath}"`);
    }

    if (!needSaveICS && !needSaveJSON) {
        console.log('[-] No need to save');
    }

    console.log('[***] Done\n');
}
main(ServerEnum.GL)
    .then(() => main(ServerEnum.JP))
    .then(() => main(ServerEnum.CN));
