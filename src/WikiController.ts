import { EventType } from './type/EventType.ts';
import { load } from 'cheerio';
import { crc32 } from '@deno-library/crc32';
import { timeout } from './BaseUtil.ts';


async function getGLAllEvents(): Promise<EventType[]> {
    const res = await fetch('https://bluearchive.wiki/wiki/Events').then(res => res.text());
    const $ = load(res);

    const result: EventType[] = [];
    $('#tabber-tabpanel-Global_version-0 table tbody tr').slice(1).each((_i, v) => {
        const name = $(v).find('td').eq(0).text().trim();
        // "2022-10-04"
        // 这里只有日期，因为所有的活动的开始和结束时间都是固定的
        const startStr = $(v).find('td').eq(1).text().trim();
        const endStr = $(v).find('td').eq(2).text().trim();
        const desc = $(v).find('td').eq(3).text().trim();
        result.push({
            // 这里用 title 的原因是因为其不太可能会变化
            // 但是只用 title 是不行的，有些 return 的活动 title 是一样的，
            // 所以还要加上 startStr，虽然这个字段也可能变化，但是目前没有更好的办法
            id: crc32($(v).find('td a').first().attr('title')! + startStr),
            name,
            start: new Date(startStr + ' 12:30 UTC-0800'),
            end: new Date(endStr + ' 12:00 UTC-0800'),
            description: desc ? desc : void 0
        });
    });
    return result;

}

/** 基本同上 */
async function getJPAllEvents(): Promise<EventType[]> {
    const res = await fetch('https://bluearchive.wiki/wiki/Events').then(res => res.text());
    const $ = load(res);

    const result: EventType[] = [];
    $('#tabber-tabpanel-Japanese_version-0 table tbody tr').slice(1).each((_i, v) => {
        const name = $(v).find('td').eq(1).text().trim();
        const startStr = $(v).find('td').eq(2).text().trim();
        const endStr = $(v).find('td').eq(3).text().trim();
        const desc = $(v).find('td').eq(4).text().trim();
        result.push({
            id: crc32($(v).find('td a').first().attr('title')! + startStr),
            name,
            start: new Date(startStr + ' 12:30 UTC-0800'),
            end: new Date(endStr + ' 12:00 UTC-0800'),
            description: desc ? desc : void 0
        });
    });
    return result;
}

async function getCNAllEvents(): Promise<EventType[]> {
    const result: EventType[] = [];
    // 时间戳从本月开始
    const timestamp = new Date();
    timestamp.setUTCHours(0, 0, 0, 0);
    timestamp.setUTCDate(1);

    while (true) {
        const res = await fetch(`https://www.gamekee.com/v1/activity/query?active_at=${timestamp.getTime() / 1000}`, {
            headers: {
                'game-alias': 'ba'
            }
        }).then(res => res.json()) as {
            data: {
                id: number;
                title: string;
                // 时间戳 (秒)
                begin_at: number;
                end_at: number;
                pub_area: '国际服' | '日服' | '国服';
            }[];
        };
        if (!res.data.length) break;

        res.data.filter(v => {
            if (v.pub_area !== '国服') return false;
            if (v.title.includes('卡池')) return false;
            return true;
        }).forEach(v => {
            result.push({
                id: v.id.toString(),
                name: v.title,
                start: new Date(v.begin_at * 1000),
                end: new Date(v.end_at * 1000)
            });
        });

        // 向前一月
        timestamp.setMonth(timestamp.getMonth() - 1);

        await timeout(200);
    }

    return result;
}


export {
    getGLAllEvents,
    getJPAllEvents,
    getCNAllEvents
}
