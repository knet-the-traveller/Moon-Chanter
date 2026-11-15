import {useAppStore} from '../store/useAppStore';
import {getTranslation} from '../i18n';
export function DemoModeNotice(){
 const {useDemoAssumptions,setDemoAssumptions,language}=useAppStore();
 return <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" aria-label={getTranslation(language,'mvp.modeTitle')}>
  <p className="font-bold">{getTranslation(language,useDemoAssumptions?'mvp.modeTitle':'mvp.fieldMode')}</p>
  <p className="mt-1">{getTranslation(language,useDemoAssumptions?'mvp.modeHelp':'mvp.fieldHelp')}</p>
  <button type="button" onClick={()=>setDemoAssumptions(!useDemoAssumptions)} className="mt-2 rounded-lg bg-emerald-800 px-3 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-emerald-950">
   {getTranslation(language,useDemoAssumptions?'mvp.disable':'mvp.enable')}
  </button>
 </section>;
}
