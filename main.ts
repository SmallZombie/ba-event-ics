import { join } from '@std/path';
import { Vcalendar, VcalendarBuilder, Vevent } from './src/BaseUtil.ts';
import { getCNAllEvents, getGLAllEvents, getJPAllEvents } from './src/WikiController.ts';
import { ReleaseJsonType } from './src/type/ReleaseJsonType.ts';
import { UID_PREFIX } from './src/Const.ts';
import { existsSync } from '@std/fs/exists';
import { ServerEnum } from './src/enum/ServerEnum.ts';


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
    const json = getJson(server);
    const events = await (() => {
        switch (server) {
            case ServerEnum.GL: return getGLAllEvents();
            case ServerEnum.JP: return getJPAllEvents();
            case ServerEnum.CN: return getCNAllEvents();
            default: throw new Error(`Invalid server: "${server}"`);
        }
    })();

    let needSaveJSON = false;
    console.log('[!] Total Events:', events.length);
    for (let i = 0; i < events.length; i++) {
        const item = events[i];
        const dtstart = ics.dateToDateTime(item.start);
        const dtend = ics.dateToDateTime(item.end);

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
            if (jsonItem.start !== item.start.toISOString()) {
                console.log(`${i + 1}/${events.length} Update "${item.name}"(${item.id}) start field in JSON. (${jsonItem.start} -> ${item.start.toISOString()})`);
                jsonItem.start = item.start.toISOString();
                needSaveJSON = true;
            }
            if (jsonItem.end !== item.end.toISOString()) {
                console.log(`${i + 1}/${events.length} Update "${item.name}"(${item.id}) end field in JSON. (${jsonItem.end} -> ${item.end.toISOString()})`);
                jsonItem.end = item.end.toISOString();
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
                start: item.start.toISOString(),
                end: item.end.toISOString(),
                description: item.description ? item.description : void 0
            });
            needSaveJSON = true;
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
