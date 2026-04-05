// ── i18n.js — Internationalization (EN / RO / HU) ──

const LANGS = {
  en: {
    // Sign-in
    signin_sub:          'Track your meds, vitals, and labs.<br>Your data stays in your own Google Drive.',
    signin_btn:          'Sign in with Google',
    signin_note:         'We only access files this app creates.',
    reconnect_text:      'Session expired —',
    reconnect_btn:       'Reconnect',
    // Tabs
    tab_meds:            'Meds',
    tab_fluids:          'Fluids',
    tab_urine:           'Urine',
    tab_health:          'Health',
    tab_labs:            'Labs',
    // Editor bar
    editor_back:         '← Back',
    editor_title:        'Med Schedule',
    btn_save:            'Save',
    // Day nav
    today_badge:         'today',
    past_badge:          'past',
    days:                ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    months:              ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    // Meds column
    meds_title:          'Meds',
    no_meds_yet:         'No meds scheduled yet.',
    setup_schedule:      'Set up schedule',
    reset_today:         'reset today',
    reset_confirm:       'Reset all data for today?',
    unnamed:             'unnamed',
    // Editor
    editor_no_meds:      'No meds yet. Add a time slot to get started.',
    add_med:             '+ Med',
    add_time_slot:       '+ Add time slot',
    field_name:          'Name',
    field_dose:          'Dose',
    field_dose_ph:       'e.g. 10mg',
    field_dose_alt_ph:   'dose on alternate days',
    field_schedule:      'Schedule',
    field_alt_dose:      'Alt dose',
    field_time:          'Time',
    field_condition:     'Condition',
    field_cond_ph:       'e.g. bp>140/90',
    field_notes:         'Notes',
    editor_remove_med:   'Remove med',
    editor_delete_confirm: 'Remove "{name}" from schedule?\n(Past days will still show it.)',
    editor_time_prompt:  'Time slot (HH:MM):',
    editor_time_default: '08:00',
    // Alt rules
    rule_every_day:      'Every day',
    rule_odd_days:       'Odd days',
    rule_even_days:      'Even days',
    rule_mon_wed_fri:    'Mon/Wed/Fri',
    rule_tue_thu_sat:    'Tue/Thu/Sat',
    rule_weekdays:       'Weekdays',
    // Save states
    saving:              'Saving…',
    save_failed:         'Save failed: ',
    // Settings
    settings_title:      'Settings',
    water_target:        'Water target',
    day_starts:          'Day starts',
    ml:                  'ml',
    // Health
    health_title:        'Health',
    vital_am:            'AM',
    vital_pm:            'PM',
    vital_wt:            'Wt',
    vital_temp:          'T°',
    notes_ph:            'How are you feeling today?',
    notes_label:         'Notes',
    night:               'night',
    ok_btn:              'OK',
    take_med:            'take med',
    // Fluids
    fluids_title:        'Fluids',
    urine_title:         'Urine',
    fluid_ml_prompt:     'ml?',
    water_done:          'Done! Well done!',
    water_times_up:      '{remaining} ml left — time\'s up!',
    water_easy:          '{remaining} ml left — {mlPerHour} ml/h — easy',
    water_glass:         '{remaining} ml left — {mlPerHour} ml/h — a glass every ~{minutes} min',
    water_more:          '{remaining} ml left — {mlPerHour} ml/h — drink more!',
    water_now:           '{remaining} ml left — {mlPerHour} ml/h — drink now!',
    // Labs
    labs_title:          'Labs',
    labs_date:           'Date',
    labs_creatinine:     'Creatinine',
    labs_tacrolimus:     'Tacrolimus',
    labs_notes_ph:       'Notes (optional)',
    labs_add:            'Add result',
    labs_no_results:     'No lab results yet.',
    labs_delete_confirm: 'Delete lab result for {date}?',
    labs_failed_save:    'Failed to save: ',
    labs_failed_delete:  'Failed to delete: ',
    labs_last_n:         'last {n}',
    // Nav
    signout:             'Sign out',
    // Validation
    val_enter_date:      'Please enter a date.',
    val_enter_value:     'Enter at least one value.',
  },

  ro: {
    // Sign-in
    signin_sub:          'Urmărește-ți medicamentele, vitalele și analizele.<br>Datele rămân în Google Drive-ul tău.',
    signin_btn:          'Conectează-te cu Google',
    signin_note:         'Accesăm doar fișierele create de această aplicație.',
    reconnect_text:      'Sesiune expirată —',
    reconnect_btn:       'Reconectează-te',
    // Tabs
    tab_meds:            'Medic.',
    tab_fluids:          'Lichide',
    tab_urine:           'Urină',
    tab_health:          'Sănătate',
    tab_labs:            'Analize',
    // Editor bar
    editor_back:         '← Înapoi',
    editor_title:        'Program medicație',
    btn_save:            'Salvează',
    // Day nav
    today_badge:         'azi',
    past_badge:          'trecut',
    days:                ['Dum','Lun','Mar','Mie','Joi','Vin','Sâm'],
    months:              ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'],
    // Meds column
    meds_title:          'Medicamente',
    no_meds_yet:         'Niciun medicament programat încă.',
    setup_schedule:      'Configurați programul',
    reset_today:         'resetează azi',
    reset_confirm:       'Resetați toate datele pentru azi?',
    unnamed:             'fără nume',
    // Editor
    editor_no_meds:      'Niciun medicament. Adăugați un interval de timp.',
    add_med:             '+ Medicament',
    add_time_slot:       '+ Adaugă interval orar',
    field_name:          'Nume',
    field_dose:          'Doză',
    field_dose_ph:       'ex. 10mg',
    field_dose_alt_ph:   'doză în zile alternante',
    field_schedule:      'Program',
    field_alt_dose:      'Doză alternantă',
    field_time:          'Oră',
    field_condition:     'Condiție',
    field_cond_ph:       'ex. bp>140/90',
    field_notes:         'Notițe',
    editor_remove_med:   'Șterge medicament',
    editor_delete_confirm: 'Ștergeți "{name}" din program?\n(Va apărea în zilele trecute.)',
    editor_time_prompt:  'Interval orar (HH:MM):',
    editor_time_default: '08:00',
    // Alt rules
    rule_every_day:      'În fiecare zi',
    rule_odd_days:       'Zile impare',
    rule_even_days:      'Zile pare',
    rule_mon_wed_fri:    'Lun/Mie/Vin',
    rule_tue_thu_sat:    'Mar/Joi/Sâm',
    rule_weekdays:       'Zilele săptămânii',
    // Save states
    saving:              'Se salvează…',
    save_failed:         'Salvare eșuată: ',
    // Settings
    settings_title:      'Setări',
    water_target:        'Țintă apă',
    day_starts:          'Ziua începe',
    ml:                  'ml',
    // Health
    health_title:        'Sănătate',
    vital_am:            'AM',
    vital_pm:            'PM',
    vital_wt:            'Gr',
    vital_temp:          'T°',
    notes_ph:            'Cum te simți azi?',
    notes_label:         'Notițe',
    night:               'noapte',
    ok_btn:              'OK',
    take_med:            'ia medicamentul',
    // Fluids
    fluids_title:        'Lichide',
    urine_title:         'Urină',
    fluid_ml_prompt:     'ml?',
    water_done:          'Gata! Bravo!',
    water_times_up:      'Mai rămân {remaining} ml — timp expirat!',
    water_easy:          'Mai rămân {remaining} ml — {mlPerHour} ml/h — ușor',
    water_glass:         'Mai rămân {remaining} ml — {mlPerHour} ml/h — un pahar la ~{minutes} min',
    water_more:          'Mai rămân {remaining} ml — {mlPerHour} ml/h — bea mai mult!',
    water_now:           'Mai rămân {remaining} ml — {mlPerHour} ml/h — bea acum!',
    // Labs
    labs_title:          'Analize',
    labs_date:           'Data',
    labs_creatinine:     'Creatinină',
    labs_tacrolimus:     'Tacrolimus',
    labs_notes_ph:       'Notițe (opțional)',
    labs_add:            'Adaugă rezultat',
    labs_no_results:     'Niciun rezultat de laborator.',
    labs_delete_confirm: 'Ștergeți rezultatul de laborator pentru {date}?',
    labs_failed_save:    'Salvare eșuată: ',
    labs_failed_delete:  'Ștergere eșuată: ',
    labs_last_n:         'ultimele {n}',
    // Nav
    signout:             'Deconectare',
    // Validation
    val_enter_date:      'Vă rugăm să introduceți o dată.',
    val_enter_value:     'Introduceți cel puțin o valoare.',
  },

  hu: {
    // Sign-in
    signin_sub:          'Kövesd nyomon gyógyszereidet, mérőszámaidat és laboreredményeidet.<br>Adataid a saját Google Drive-odon maradnak.',
    signin_btn:          'Bejelentkezés Google-lel',
    signin_note:         'Csak az alkalmazás által létrehozott fájlokhoz férünk hozzá.',
    reconnect_text:      'Munkamenet lejárt —',
    reconnect_btn:       'Újracsatlakozás',
    // Tabs
    tab_meds:            'Gyógyszer',
    tab_fluids:          'Folyadék',
    tab_urine:           'Vizelet',
    tab_health:          'Egészség',
    tab_labs:            'Labor',
    // Editor bar
    editor_back:         '← Vissza',
    editor_title:        'Gyógyszer-ütemterv',
    btn_save:            'Mentés',
    // Day nav
    today_badge:         'ma',
    past_badge:          'múlt',
    days:                ['Vas','Hét','Ked','Sze','Csü','Pén','Szo'],
    months:              ['Jan','Feb','Már','Ápr','Máj','Jún','Júl','Aug','Sze','Okt','Nov','Dec'],
    // Meds column
    meds_title:          'Gyógyszer',
    no_meds_yet:         'Még nincs ütemezett gyógyszer.',
    setup_schedule:      'Ütemterv beállítása',
    reset_today:         'mai nap visszaállítása',
    reset_confirm:       'Visszaállítja a mai nap összes adatát?',
    unnamed:             'névtelen',
    // Editor
    editor_no_meds:      'Még nincs gyógyszer. Adjon hozzá időpontot a kezdéshez.',
    add_med:             '+ Gyógyszer',
    add_time_slot:       '+ Időpont hozzáadása',
    field_name:          'Név',
    field_dose:          'Dózis',
    field_dose_ph:       'pl. 10mg',
    field_dose_alt_ph:   'dózis minden második nap',
    field_schedule:      'Ütemezés',
    field_alt_dose:      'Alternatív dózis',
    field_time:          'Idő',
    field_condition:     'Feltétel',
    field_cond_ph:       'pl. vp>140/90',
    field_notes:         'Megjegyzések',
    editor_remove_med:   'Gyógyszer törlése',
    editor_delete_confirm: 'Eltávolítja a(z) "{name}" gyógyszert az ütemtervből?\n(Korábbi napokon még megjelenik.)',
    editor_time_prompt:  'Időpont (ÓÓ:PP):',
    editor_time_default: '08:00',
    // Alt rules
    rule_every_day:      'Minden nap',
    rule_odd_days:       'Páratlan napok',
    rule_even_days:      'Páros napok',
    rule_mon_wed_fri:    'Hét/Sze/Pén',
    rule_tue_thu_sat:    'Ked/Csü/Szo',
    rule_weekdays:       'Hétköznapok',
    // Save states
    saving:              'Mentés…',
    save_failed:         'Mentési hiba: ',
    // Settings
    settings_title:      'Beállítások',
    water_target:        'Vízfogyasztási cél',
    day_starts:          'Nap kezdete',
    ml:                  'ml',
    // Health
    health_title:        'Egészség',
    vital_am:            'DE',
    vital_pm:            'DU',
    vital_wt:            'Ts',
    vital_temp:          'T°',
    notes_ph:            'Hogy érzi magát ma?',
    notes_label:         'Megjegyzések',
    night:               'éjszaka',
    ok_btn:              'OK',
    take_med:            'vegye be a gyógyszert',
    // Fluids
    fluids_title:        'Folyadék',
    urine_title:         'Vizelet',
    fluid_ml_prompt:     'ml?',
    water_done:          'Kész! Szép munka!',
    water_times_up:      '{remaining} ml maradt — lejárt az idő!',
    water_easy:          '{remaining} ml maradt — {mlPerHour} ml/h — könnyen megy',
    water_glass:         '{remaining} ml maradt — {mlPerHour} ml/h — egy pohár kb. {minutes} percenként',
    water_more:          '{remaining} ml maradt — {mlPerHour} ml/h — igyál többet!',
    water_now:           '{remaining} ml maradt — {mlPerHour} ml/h — igyál most!',
    // Labs
    labs_title:          'Labor',
    labs_date:           'Dátum',
    labs_creatinine:     'Kreatinin',
    labs_tacrolimus:     'Takrolimusz',
    labs_notes_ph:       'Megjegyzések (opcionális)',
    labs_add:            'Eredmény hozzáadása',
    labs_no_results:     'Még nincs laboreredmény.',
    labs_delete_confirm: 'Törli a(z) {date} laboreredményt?',
    labs_failed_save:    'Mentési hiba: ',
    labs_failed_delete:  'Törlési hiba: ',
    labs_last_n:         'utolsó {n}',
    // Nav
    signout:             'Kijelentkezés',
    // Validation
    val_enter_date:      'Kérjük adjon meg egy dátumot.',
    val_enter_value:     'Adjon meg legalább egy értéket.',
  },
};

let _lang = localStorage.getItem('mt_lang') || 'en';

export const SUPPORTED_LANGS = ['en', 'ro', 'hu'];

/** Translate a string key, replacing {param} placeholders. */
export function t(key, params = {}) {
  const str = LANGS[_lang]?.[key] ?? LANGS.en[key] ?? key;
  if (typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
}

/** Get an array value (e.g. days, months). */
export function tArr(key) {
  return LANGS[_lang]?.[key] ?? LANGS.en[key] ?? [];
}

export function getLang() { return _lang; }

export function setLang(lang) {
  if (!LANGS[lang]) return;
  _lang = lang;
  localStorage.setItem('mt_lang', lang);
  document.documentElement.lang = lang;
  applyStaticTranslations();
}

/** Update all static HTML elements (sign-in, tabs, editor bar). */
export function applyStaticTranslations() {
  // Sign-in view
  const signinSub  = document.querySelector('.signin-sub');
  const signinBtn  = document.getElementById('signinBtn');
  const signinNote = document.querySelector('.signin-note');
  if (signinSub)  signinSub.innerHTML   = t('signin_sub');
  if (signinBtn)  signinBtn.textContent = t('signin_btn');
  if (signinNote) signinNote.textContent = t('signin_note');

  // Reconnect banner
  const reconnectText = document.getElementById('reconnectText');
  const reconnectBtn  = document.getElementById('reconnectBtn');
  if (reconnectText) reconnectText.textContent = t('reconnect_text') + ' ';
  if (reconnectBtn)  reconnectBtn.textContent  = t('reconnect_btn');

  // Mobile tabs
  const tabKeys = ['tab_meds','tab_fluids','tab_urine','tab_health','tab_labs'];
  document.querySelectorAll('.mob-tab').forEach((tab, i) => {
    if (tabKeys[i]) tab.textContent = t(tabKeys[i]);
  });

  // Editor bar
  const editorBack  = document.querySelector('.editor-back');
  const editorTitle = document.querySelector('.editor-title');
  const editorSave  = document.getElementById('editorSaveBtn');
  if (editorBack)  editorBack.textContent  = t('editor_back');
  if (editorTitle) editorTitle.textContent = t('editor_title');
  if (editorSave && !editorSave.disabled)  editorSave.textContent = t('btn_save');

  // Sign out button
  const signoutBtn = document.getElementById('signoutBtn');
  if (signoutBtn) signoutBtn.textContent = t('signout');

  // Sync language selects to current lang
  ['langSelect', 'langSelectSignin', 'langSelectEditor'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.value = _lang;
  });
}
