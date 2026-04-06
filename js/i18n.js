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
    tab_notes:           'Notes',
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
    vitals_title:        'Vitals',
    meds_title:          'Meds',
    no_meds_yet:         'No meds scheduled yet.',
    setup_schedule:      'Set up schedule',
    expand_all:          'expand all',
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
    bp_readings_label:   'BP readings/day',
    ml:                  'ml',
    // Health
    health_title:        'Health',
    vital_bp:            'BP {n}',
    vital_wt:            'Weight',
    vital_temp:          'Temp',
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
    // Fluid types
    drink_water:         'Water',
    drink_coffee:        'Coffee',
    drink_tea:           'Tea',
    drink_juice:         'Juice',
    drink_soup:          'Soup',
    drink_other:         'Other',
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
    // Status
    offline_banner:      'Offline — changes saved locally',
    welcome_title:       'Welcome to Med Tracker',
    welcome_text:        'Add your medications, set the times, and start tracking. Your data is stored securely in your own Google Drive.',
    welcome_btn:         'Set up my meds',
    // Nav
    signout:             'Sign out',
    // Validation
    val_enter_date:      'Please enter a date.',
    val_enter_value:     'Enter at least one value.',
    // Tooltips
    tip_bp:              'Enter systolic (top) / diastolic (bottom) in mmHg. Values ≥ 140/90 are flagged as high.',
    tip_weight:          'Body weight (kg)',
    tip_temp:            'Body temperature (°C). Alert if ≥ 37.5°C',
    tip_water_target:    'Daily fluid intake goal (ml)',
    tip_day_start:       'Hour (0–6): entries before this time count for the previous day',
    tip_bp_times:        'Number of blood pressure readings per day (1–4)',
    tip_creatinine:      'Creatinine (mg/dL) — kidney function marker. Normal: 0.6–1.2',
    tip_tacrolimus:      'Tacrolimus (ng/mL) — immunosuppressant level. Target range set by your doctor.',
    tip_reset:           'Clear all meds, fluids and vitals for today',
    tip_del:             'Delete',
    tip_custom_fluid:    'Add a custom amount (ml)',
    // Charts
    nav_charts:          'Charts',
    nav_reports:         'Reports',
    charts_title:        'Charts',
    charts_bp:           'Blood Pressure',
    charts_fluids:       'Fluid Balance',
    charts_weight:       'Weight',
    charts_labs:         'Lab Results',
    charts_temp:         'Temperature',
    charts_adherence:    'Medication Adherence',
    charts_no_data:      'No data for this period.',
    charts_load_error:   'Failed to load data. Try again.',
    charts_sys_am:       'Systolic AM',
    charts_dia_am:       'Diastolic AM',
    charts_sys_pm:       'Systolic PM',
    charts_dia_pm:       'Diastolic PM',
    charts_water_in:     'Water in',
    charts_urine_out:    'Urine out',
    charts_net_balance:  'Net balance',
    charts_target:       'Target',
    charts_creatinine:   'Creatinine',
    charts_tacrolimus:   'Tacrolimus',
    charts_weight_series:'Weight (kg)',
    charts_temp_series:  'Temperature (°C)',
    charts_adherence_series: '% Meds taken',
    // Reports
    reports_title:       'Reports',
    reports_7d:          'Last 7 days',
    reports_30d:         'Last 30 days',
    reports_90d:         'Last 90 days',
    reports_custom:      'Custom range',
    reports_generate:    'Generate Report',
    reports_print:       'Print / PDF',
    reports_header_title:'Medical Report',
    reports_patient:     'Patient',
    reports_generated:   'Generated',
    reports_period_label:'Period',
    reports_vitals_title:'Vitals Summary',
    reports_fluids_title:'Fluid Balance',
    reports_labs_title:  'Lab Results',
    reports_meds_title:  'Medication Adherence',
    reports_alerts_title:'Alerts & Flags',
    reports_no_alerts:   'No alerts for this period.',
    reports_daily_table: 'Daily Data',
    reports_history:     'History',
    reports_days:        'days',
    reports_stat_bp_avg:       'Average BP',
    reports_stat_bp_range:     'BP range',
    reports_stat_bp_readings:  'Readings logged',
    reports_stat_weight_avg:   'Average weight',
    reports_stat_weight_range: 'Weight range',
    reports_stat_weight_delta: 'Net change',
    reports_stat_temp_avg:     'Average temp',
    reports_stat_temp_max:     'Max temp',
    reports_stat_fever_days:   'Fever days',
    reports_stat_avg_water:    'Avg daily intake',
    reports_stat_avg_urine:    'Avg daily output',
    reports_stat_fluid_days:   'Days tracked',
    reports_stat_meds_taken:   'Medications taken',
    reports_stat_adherence:    'Adherence rate',
    reports_alert_high_bp:     'High BP',
    reports_alert_weight_jump: 'Weight jump ≥1 kg',
    reports_alert_fever:       'Fever',
    reports_alert_missed_meds: 'Incomplete med days',
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
    tab_notes:           'Notițe',
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
    vitals_title:        'Semne vitale',
    meds_title:          'Medicamente',
    no_meds_yet:         'Niciun medicament programat încă.',
    setup_schedule:      'Configurați programul',
    expand_all:          'extinde tot',
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
    bp_readings_label:   'Măsurători tensiune/zi',
    ml:                  'ml',
    // Health
    health_title:        'Sănătate',
    vital_bp:            'Tensiune {n}',
    vital_wt:            'Greutate',
    vital_temp:          'Temperatură',
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
    // Fluid types
    drink_water:         'Apă',
    drink_coffee:        'Cafea',
    drink_tea:           'Ceai',
    drink_juice:         'Suc',
    drink_soup:          'Supă',
    drink_other:         'Altele',
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
    // Status
    offline_banner:      'Offline — modificările sunt salvate local',
    welcome_title:       'Bun venit la Med Tracker',
    welcome_text:        'Adăugați medicamentele, setați orele și începeți urmărirea. Datele sunt stocate în siguranță în Google Drive-ul dvs.',
    welcome_btn:         'Configurează medicamentele',
    // Nav
    signout:             'Deconectare',
    // Validation
    val_enter_date:      'Vă rugăm să introduceți o dată.',
    val_enter_value:     'Introduceți cel puțin o valoare.',
    // Tooltips
    tip_bp:              'Introduceți sistolică (sus) / diastolică (jos) în mmHg. Valorile ≥ 140/90 sunt marcate ca ridicate.',
    tip_weight:          'Greutate corporală (kg)',
    tip_temp:            'Temperatură corporală (°C). Alertă dacă ≥ 37,5°C',
    tip_water_target:    'Obiectiv zilnic de aport de lichide (ml)',
    tip_day_start:       'Ora (0–6): intrările de dinaintea acestei ore aparțin zilei precedente',
    tip_bp_times:        'Număr de măsurători ale tensiunii pe zi (1–4)',
    tip_creatinine:      'Creatinină (mg/dL) — marker al funcției renale. Normal: 0,6–1,2',
    tip_tacrolimus:      'Tacrolimus (ng/mL) — nivel imunosupresor. Valoare țintă conform medicului.',
    tip_reset:           'Șterge toate datele de azi (medicamente, lichide, vitale)',
    tip_del:             'Șterge',
    tip_custom_fluid:    'Adaugă o cantitate personalizată (ml)',
    // Charts
    nav_charts:          'Grafice',
    nav_reports:         'Rapoarte',
    charts_title:        'Grafice',
    charts_bp:           'Tensiune arterială',
    charts_fluids:       'Bilanț lichide',
    charts_weight:       'Greutate',
    charts_labs:         'Rezultate laborator',
    charts_temp:         'Temperatură',
    charts_adherence:    'Aderență la medicație',
    charts_no_data:      'Nu există date pentru această perioadă.',
    charts_load_error:   'Eroare la încărcarea datelor. Reîncercați.',
    charts_sys_am:       'Sistolică AM',
    charts_dia_am:       'Diastolică AM',
    charts_sys_pm:       'Sistolică PM',
    charts_dia_pm:       'Diastolică PM',
    charts_water_in:     'Lichide ingerate',
    charts_urine_out:    'Urină',
    charts_net_balance:  'Bilanț net',
    charts_target:       'Țintă',
    charts_creatinine:   'Creatinină',
    charts_tacrolimus:   'Tacrolimus',
    charts_weight_series:'Greutate (kg)',
    charts_temp_series:  'Temperatură (°C)',
    charts_adherence_series: '% Medicamente luate',
    // Reports
    reports_title:       'Rapoarte',
    reports_7d:          'Ultimele 7 zile',
    reports_30d:         'Ultimele 30 zile',
    reports_90d:         'Ultimele 90 zile',
    reports_custom:      'Interval personalizat',
    reports_generate:    'Generează raport',
    reports_print:       'Tipărire / PDF',
    reports_header_title:'Raport medical',
    reports_patient:     'Pacient',
    reports_generated:   'Generat',
    reports_period_label:'Perioadă',
    reports_vitals_title:'Rezumat vitale',
    reports_fluids_title:'Bilanț lichide',
    reports_labs_title:  'Rezultate laborator',
    reports_meds_title:  'Aderență la medicație',
    reports_alerts_title:'Alerte',
    reports_no_alerts:   'Nicio alertă pentru această perioadă.',
    reports_daily_table: 'Date zilnice',
    reports_history:     'Istoric',
    reports_days:        'zile',
    reports_stat_bp_avg:       'Tensiune medie',
    reports_stat_bp_range:     'Interval tensiune',
    reports_stat_bp_readings:  'Măsurători înregistrate',
    reports_stat_weight_avg:   'Greutate medie',
    reports_stat_weight_range: 'Interval greutate',
    reports_stat_weight_delta: 'Variație netă',
    reports_stat_temp_avg:     'Temperatură medie',
    reports_stat_temp_max:     'Temperatură maximă',
    reports_stat_fever_days:   'Zile cu febră',
    reports_stat_avg_water:    'Aport zilnic mediu',
    reports_stat_avg_urine:    'Eliminare zilnică medie',
    reports_stat_fluid_days:   'Zile urmărite',
    reports_stat_meds_taken:   'Medicamente luate',
    reports_stat_adherence:    'Rată de aderență',
    reports_alert_high_bp:     'Tensiune ridicată',
    reports_alert_weight_jump: 'Salt greutate ≥1 kg',
    reports_alert_fever:       'Febră',
    reports_alert_missed_meds: 'Zile cu medicație incompletă',
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
    tab_notes:           'Megjegyzések',
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
    vitals_title:        'Értékek',
    meds_title:          'Gyógyszer',
    no_meds_yet:         'Még nincs ütemezett gyógyszer.',
    setup_schedule:      'Ütemterv beállítása',
    expand_all:          'mind kinyit',
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
    bp_readings_label:   'Vérnyomásmérések/nap',
    ml:                  'ml',
    // Health
    health_title:        'Egészség',
    vital_bp:            'Vérnyomás {n}',
    vital_wt:            'Testsúly',
    vital_temp:          'Hőmérséklet',
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
    // Fluid types
    drink_water:         'Víz',
    drink_coffee:        'Kávé',
    drink_tea:           'Tea',
    drink_juice:         'Gyümölcslé',
    drink_soup:          'Leves',
    drink_other:         'Egyéb',
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
    // Status
    offline_banner:      'Offline — a változások helyben mentve',
    welcome_title:       'Üdvözöljük a Med Trackerben',
    welcome_text:        'Adja hozzá gyógyszereit, állítsa be az időpontokat, és kezdje el a követést. Adatai biztonságosan a saját Google Drive-ján tárolódnak.',
    welcome_btn:         'Gyógyszerek beállítása',
    // Nav
    signout:             'Kijelentkezés',
    // Validation
    val_enter_date:      'Kérjük adjon meg egy dátumot.',
    val_enter_value:     'Adjon meg legalább egy értéket.',
    // Tooltips
    tip_bp:              'Adja meg a szisztolés (felső) / diasztolés (alsó) értéket Hgmm-ben. A ≥ 140/90 értékek magasként jelennek meg.',
    tip_weight:          'Testsúly (kg)',
    tip_temp:            'Testhőmérséklet (°C). Riasztás ≥ 37,5°C esetén',
    tip_water_target:    'Napi folyadékbeviteli cél (ml)',
    tip_day_start:       'Óra (0–6): ennél korábbi bejegyzések az előző naphoz tartoznak',
    tip_bp_times:        'Napi vérnyomásmérések száma (1–4)',
    tip_creatinine:      'Kreatinin (mg/dL) — vesefunkció-mutató. Normál: 0,6–1,2',
    tip_tacrolimus:      'Takrolimusz (ng/mL) — immunszuppresszív szint. Célérték: orvos szerint.',
    tip_reset:           'Törli a mai gyógyszerek, folyadékok és vitálisok adatait',
    tip_del:             'Törlés',
    tip_custom_fluid:    'Egyedi mennyiség hozzáadása (ml)',
    // Charts
    nav_charts:          'Grafikonok',
    nav_reports:         'Jelentések',
    charts_title:        'Grafikonok',
    charts_bp:           'Vérnyomás',
    charts_fluids:       'Folyadékmérleg',
    charts_weight:       'Testsúly',
    charts_labs:         'Laboreredmények',
    charts_temp:         'Hőmérséklet',
    charts_adherence:    'Gyógyszer-adherencia',
    charts_no_data:      'Nincs adat erre az időszakra.',
    charts_load_error:   'Adatbetöltési hiba. Próbálja újra.',
    charts_sys_am:       'Szisztolés DE',
    charts_dia_am:       'Diasztolés DE',
    charts_sys_pm:       'Szisztolés DU',
    charts_dia_pm:       'Diasztolés DU',
    charts_water_in:     'Folyadékbevitel',
    charts_urine_out:    'Vizelet',
    charts_net_balance:  'Nettó mérleg',
    charts_target:       'Cél',
    charts_creatinine:   'Kreatinin',
    charts_tacrolimus:   'Takrolimusz',
    charts_weight_series:'Testsúly (kg)',
    charts_temp_series:  'Hőmérséklet (°C)',
    charts_adherence_series: '% Bevett gyógyszer',
    // Reports
    reports_title:       'Jelentések',
    reports_7d:          'Utolsó 7 nap',
    reports_30d:         'Utolsó 30 nap',
    reports_90d:         'Utolsó 90 nap',
    reports_custom:      'Egyéni időszak',
    reports_generate:    'Jelentés generálása',
    reports_print:       'Nyomtatás / PDF',
    reports_header_title:'Orvosi jelentés',
    reports_patient:     'Páciens',
    reports_generated:   'Létrehozva',
    reports_period_label:'Időszak',
    reports_vitals_title:'Vitálisok összefoglalója',
    reports_fluids_title:'Folyadékmérleg',
    reports_labs_title:  'Laboreredmények',
    reports_meds_title:  'Gyógyszer-adherencia',
    reports_alerts_title:'Figyelmeztetések',
    reports_no_alerts:   'Nincs figyelmeztetés erre az időszakra.',
    reports_daily_table: 'Napi adatok',
    reports_history:     'Előzmények',
    reports_days:        'nap',
    reports_stat_bp_avg:       'Átlagos vérnyomás',
    reports_stat_bp_range:     'Vérnyomás tartomány',
    reports_stat_bp_readings:  'Rögzített mérések',
    reports_stat_weight_avg:   'Átlagos testsúly',
    reports_stat_weight_range: 'Testsúly tartomány',
    reports_stat_weight_delta: 'Nettó változás',
    reports_stat_temp_avg:     'Átlaghőmérséklet',
    reports_stat_temp_max:     'Maximális hőmérséklet',
    reports_stat_fever_days:   'Lázas napok',
    reports_stat_avg_water:    'Napi átlagos bevitel',
    reports_stat_avg_urine:    'Napi átlagos kiválasztás',
    reports_stat_fluid_days:   'Követett napok',
    reports_stat_meds_taken:   'Bevett gyógyszerek',
    reports_stat_adherence:    'Adherencia arány',
    reports_alert_high_bp:     'Magas vérnyomás',
    reports_alert_weight_jump: 'Testsúly-ugrás ≥1 kg',
    reports_alert_fever:       'Láz',
    reports_alert_missed_meds: 'Hiányos gyógyszer-napok',
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
  const tabKeys = ['tab_meds','tab_fluids','tab_urine','tab_notes','tab_labs'];
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
