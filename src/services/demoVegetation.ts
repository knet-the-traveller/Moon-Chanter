import munoz from '../../public/sample-data/munoz.json';
import ilagan from '../../public/sample-data/ilagan.json';
import pototan from '../../public/sample-data/pototan.json';
import malaybalay from '../../public/sample-data/malaybalay.json';
import {NdviMonthlySchema} from '../types/landFixture';
const sources:Record<string,unknown>={munoz:munoz.land.ndviMonthly,ilagan:ilagan.land.ndviMonthly,pototan:pototan.land.ndviMonthly,bukidnon:malaybalay.land.ndviMonthly};
/** A separate explicitly synthetic example, never used as observed NDVI. */
export function exampleProfile(id:string):number[]{return NdviMonthlySchema.parse(sources[id]??sources.munoz);}
