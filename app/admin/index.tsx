import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { FEATURES } from '@/lib/features';
import { BookOpen, Users, Ticket, LayoutDashboard, ShieldCheck, LogOut, ArrowUpLeft, Search, RefreshCw, GraduationCap } from 'lucide-react-native';
import { adminClient, loadAdminData, demoStudents, educationError, progressMetrics, type StudentRow, type EducationInvite, type RegisteredUser } from '@/lib/educationAdmin';
import { COURSE_LEVELS, SENTENCE_LESSONS } from '@/lib/courseContent';
import { toPersianDigits as fa } from '@/lib/format';

type Tab = 'overview' | 'registered' | 'students' | 'invites' | 'content';
const tabs = [
  { id: 'overview' as Tab, title: 'نمای کلی', icon: LayoutDashboard },
  { id: 'registered' as Tab, title: 'کاربران ثبت‌شده', icon: Users },
  { id: 'students' as Tab, title: 'زبان‌آموزان', icon: Users },
  { id: 'invites' as Tab, title: 'دعوت‌نامه‌ها', icon: Ticket },
  { id: 'content' as Tab, title: 'محتوای آموزشی', icon: BookOpen },
];
const dates = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('fa-IR') : 'هنوز همگام نشده';

export default function AdminRoute() {
  if (!FEATURES.adminPanel) return <Redirect href={'/languages' as never} />;
  return <EducationAdmin />;
}
function EducationAdmin() {
  const router = useRouter();
  const wide = useWindowDimensions().width > 940;
  const [mode, setMode] = useState<'login' | 'demo' | 'live'>('login');
  const [tab, setTab] = useState<Tab>('overview');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [invites, setInvites] = useState<EducationInvite[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all');
  const [label, setLabel] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const demo = mode === 'demo';
  const rows = demo ? demoStudents : students;
  const visible = rows.filter(r => r.display_name.includes(search.trim()) && (filter === 'all' || r.status === filter));
  const active = rows.filter(r => r.status === 'active');
  const synced = active.filter(r => r.summary);
  const avg = synced.length ? Math.round(synced.reduce((n,r) => n + progressMetrics(r.summary).percent, 0) / synced.length) : 0;

  async function refresh() {
    const data = await loadAdminData(); setStudents(data.students); setInvites(data.invites); setRegisteredUsers(data.registeredUsers); setSelected(null);
  }
  async function task(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(educationError(e)); } finally { setBusy(false); }
  }
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await adminClient().auth.getSession();
        if (!data.session) return;
        const result = await loadAdminData();
        if (mounted) { setStudents(result.students); setInvites(result.invites); setRegisteredUsers(result.registeredUsers); setMode('live'); }
      } catch { /* Login remains available if the migration is not installed. */ }
    })();
    return () => { mounted = false; };
  }, []);
  const login = () => task(async () => {
    const { error } = await adminClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    try { await refresh(); setMode('live'); setPassword(''); }
    catch (e) { await adminClient().auth.signOut(); throw e; }
  });
  const button = (title: string, onPress: () => void, secondary = false, disabled = false) => (
    <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress} style={[s.button, secondary && s.secondary, (disabled || busy) && { opacity: .45 }]}>
      <Text style={[s.buttonText, secondary && { color: '#344761' }]}>{title}</Text>
    </Pressable>
  );
  const feedback = <>{busy && <ActivityIndicator color="#1769D2" />}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice && <Text style={s.notice}>{notice}</Text>}</>;

  if (mode === 'login') return (
    <ScrollView contentContainerStyle={s.loginPage}>
      <View style={s.loginCard}>
        <View style={s.logo}><GraduationCap color="white" size={32} /></View>
        <Text style={s.eyebrow}>ENGLISH JOURNEY / ADMIN</Text>
        <Text style={s.title}>آموزش، با یک نگاه روشن</Text>
        <Text style={s.subtitle}>پنل مدیریت آموزشی شما؛ فقط پیشرفت زبان‌آموزانی که با رضایت عضو شده‌اند.</Text>
        <Text style={s.label}>ایمیل مدیر</Text>
        <TextInput accessibilityLabel="ایمیل مدیر" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={[s.input, s.ltr]} placeholder="you@example.com" />
        <Text style={s.label}>رمز عبور</Text>
        <TextInput accessibilityLabel="رمز عبور مدیر" secureTextEntry value={password} onChangeText={setPassword} style={[s.input, s.ltr]} onSubmitEditing={login} />
        {feedback}
        {button('ورود امن به پنل', login, false, !email.trim() || !password)}
        {button('مشاهده پیش‌نمایش با داده‌های نمونه', () => { setError(''); setMode('demo'); }, true)}
        <Text style={s.small}>حساب عادی یا ناشناس دسترسی مدیریتی ندارد. ساخت اولین مدیر از Supabase و طبق راهنمای EDUCATION-ADMIN انجام می‌شود.</Text>
        {button('بازگشت به آموزش', () => router.replace('/lang'), true)}
      </View>
    </ScrollView>
  );

  return <View style={s.root}>
    <View style={s.shell}>
      <View style={[s.sidebar, !wide && s.sidebarMobile]}>
        <View style={[s.brand, !wide && s.brandMobile]}>
          <View style={[s.logo, !wide && s.logoMobile]}><GraduationCap color="white" size={wide ? 25 : 21} /></View>
          {wide ? <View><Text style={s.brandTitle}>English Journey</Text><Text style={s.small}>فضای مدیریت آموزش</Text></View> : <Text style={s.mobileBrandTitle}>مدیریت</Text>}
        </View>
        <Text style={[s.navLabel, !wide && s.navLabelMobile]}>{wide ? 'میز کار شما' : 'منوی اصلی'}</Text>
        <View style={[s.navList, !wide && s.navListMobile]}>
          {tabs.map(t => <Pressable accessibilityRole="button" key={t.id} onPress={() => {setTab(t.id);setSelected(null);}} style={[s.navItem, !wide && s.mobileNavItem, tab === t.id && s.navActive]}><t.icon size={wide ? 19 : 20} color={tab === t.id ? '#1769D2' : '#64748B'} /><Text numberOfLines={2} style={[s.navText, !wide && s.mobileNavText, tab === t.id && s.navTextActive]}>{t.title}</Text></Pressable>)}
        </View>
        <View style={{ flex: 1 }} />
        {wide && <View style={s.privacy}><ShieldCheck size={24} color="#1769D2" /><Text style={s.cardTitle}>فقط آموزش، با رضایت</Text><Text style={s.small}>بدون دسترسی به پیام‌ها، مخاطبان یا صفحه گوشی زبان‌آموز.</Text></View>}
        <Pressable style={[s.navItem, !wide && s.mobileLogout]} onPress={() => void task(async () => { if (!demo) {const {error} = await adminClient().auth.signOut(); if(error) throw error;} setMode('login');setStudents([]);setInvites([]);setRegisteredUsers([]);setSelected(null); })}><LogOut size={18} color="#64748B" /><Text numberOfLines={2} style={[s.navText, !wide && s.mobileNavText]}>{demo ? (wide ? 'ورود به پنل واقعی' : 'ورود') : (wide ? 'خروج از حساب مدیر' : 'خروج')}</Text></Pressable>
      </View>
      <ScrollView style={s.content} contentContainerStyle={[s.main, !wide && s.mainMobile]}>
        <LinearGradient colors={['#EAF4FF', '#F8FBFF', '#FFFFFF']} start={{x:0,y:0}} end={{x:1,y:1}} style={[s.header, !wide && s.headerMobile]}><View style={{flex:1}}><Text style={s.eyebrow}>مدیریت آموزشی / {tabs.find(t => t.id === tab)?.title}</Text><Text style={[s.title, !wide && s.titleMobile]}>{tab === 'overview' ? 'رشد زبان‌آموزان، پیش چشم شما' : tabs.find(t => t.id === tab)?.title}</Text><Text style={s.subtitle}>یادگیری را دنبال کنید، نه زندگی خصوصی افراد را.</Text></View><View style={[s.pill, !wide && s.pillMobile]}><View style={s.dot} /><Text style={s.pillText}>{demo ? 'نمایشی' : 'مدیر'}</Text></View></LinearGradient>
        {demo && <Text style={s.demoBanner}>پیش‌نمایش • نام‌ها و آمار این صفحه نمونه‌اند. ایجاد دعوت و تغییر وضعیت در این حالت غیرفعال است.</Text>}
        {feedback}
        {!demo && button('تازه‌سازی گزارش‌ها', () => void task(refresh), true)}
        {tab === 'registered' && <View style={s.card}>
          <View style={s.sectionHead}><Text style={s.cardTitle}>کاربران ثبت‌شده اپ زبان</Text><Text style={s.small}>{fa(registeredUsers.length)} حساب واقعی</Text></View>
          <Text style={s.subtitle}>این فهرست شامل اطلاعات حساب و وضعیت فعالیت است؛ پیام‌های خصوصی و فایل‌های شخصی نمایش داده نمی‌شوند.</Text>
          {!registeredUsers.length && <View style={s.empty}><Users size={34} color="#1769D2" /><Text style={s.cardTitle}>هنوز کاربری ثبت‌نام نکرده است</Text></View>}
          {registeredUsers.filter(user => `${user.full_name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase())).map((user, index) => <View key={user.user_id} style={s.studentRow}>
            <View style={[s.avatar, {backgroundColor: ['#e5f3f0','#eef0ff','#fff1dc'][index%3]}]}><Text style={s.avatarText}>{user.full_name.slice(0,1)}</Text></View>
            <View style={{flex:1,minWidth:170}}><Text style={s.studentName}>{user.full_name}</Text><Text style={s.emailText}>{user.email}</Text></View>
            <View><Text style={s.small}>ثبت‌نام: {dates(user.registered_at)}</Text><Text style={s.small}>آخرین فعالیت: {dates(user.last_seen_at)}</Text></View>
            <Text style={s.badge}>{user.platform || 'نامشخص'} · {user.app_version || '—'}</Text>
          </View>)}
        </View>}
        {(tab === 'overview' || tab === 'students') && <>
          <View style={s.stats}>
            {[['کاربران ثبت‌شده', demo ? 3 : registeredUsers.length, 'حساب‌های اپ زبان'], ['زبان‌آموزان', rows.length, 'عضویت با رضایت'], ['اشتراک فعال', active.length, 'گزارش آموزشی فعال'], ['میانگین پیشرفت', `${fa(avg)}٪`, `${fa(synced.length)} نفر با گزارش همگام‌شده`], ['درس‌های دوره', SENTENCE_LESSONS.length, 'پوشش ۵۰۴ واژه مرجع']].map(([name,value,hint]) => <View key={name} style={s.stat}><Text style={s.statLabel}>{name}</Text><Text style={s.statNumber}>{typeof value === 'number' ? fa(value) : value}</Text><Text style={s.small}>{hint}</Text></View>)}
          </View>
          {tab === 'overview' && <View style={s.hero}><View style={{ flex: 1 }}><Text style={s.heroTitle}>مسیر یادگیری از یک دعوت شروع می‌شود.</Text><Text style={s.heroText}>یک دعوت اختصاصی بسازید؛ زبان‌آموز نام شما و نوع اطلاعات قابل اشتراک را می‌بیند و خودش تصمیم می‌گیرد.</Text></View>{button('دعوت زبان‌آموز جدید', () => setTab('invites'))}</View>}
          <View style={s.card}>
            <View style={s.sectionHead}><Text style={s.cardTitle}>زبان‌آموزان شما</Text><Text style={s.small}>آخرین داده ارسال‌شده از دستگاه</Text></View>
            <View style={s.toolbar}><View style={s.search}><Search size={18} color="#8390a1" /><TextInput accessibilityLabel="جستجوی نام زبان‌آموز" placeholder="جستجوی نام زبان‌آموز…" value={search} onChangeText={setSearch} style={s.searchInput} /></View><View style={s.filters}>{[['all','همه'],['active','فعال'],['paused','متوقف']].map(([id,title]) => <Pressable key={id} onPress={() => setFilter(id)} style={[s.filter, filter===id && {backgroundColor:'#E2EFFF'}]}><Text style={s.small}>{title}</Text></Pressable>)}</View></View>
            {!visible.length && <View style={s.empty}><Users size={34} color="#1769D2" /><Text style={s.cardTitle}>{rows.length ? 'نتیجه‌ای پیدا نشد' : 'اولین زبان‌آموز را دعوت کنید'}</Text><Text style={s.small}>فقط افرادی که دعوت شما را پذیرفته‌اند اینجا ظاهر می‌شوند.</Text></View>}
            {visible.map((r,i) => { const m=progressMetrics(r.summary); return <Pressable accessibilityRole="button" key={r.student_id} onPress={() => setSelected(r)} style={s.studentRow}>
              <View style={[s.avatar, {backgroundColor: ['#e5f3f0','#eef0ff','#fff1dc'][i%3]}]}><Text style={s.avatarText}>{r.display_name.slice(0,1)}</Text></View>
              <View style={{ flex: 1, minWidth: 120 }}><Text style={s.studentName}>{r.display_name}</Text><Text style={s.small}>{r.status==='paused' ? 'گزارش متوقف است' : dates(r.synced_at)}</Text></View>
              <View style={{ width: wide ? 180 : 100 }}><Text style={s.small}>{r.summary ? `${fa(m.lessons)} از ۱۶۱ درس` : 'بدون گزارش'}</Text><View style={s.track}><View style={[s.fill,{width:`${m.percent}%`}]} /></View></View>
              <Text style={[s.badge, r.status==='paused' && { backgroundColor:'#fff3df',color:'#a36512' }]}>{r.status==='active' ? 'فعال' : 'متوقف'}</Text><ArrowUpLeft size={17} color="#8190a5" />
            </Pressable>; })}
          </View>
          {selected && <View style={s.card}><View style={s.sectionHead}><Text style={s.cardTitle}>گزارش {selected.display_name}</Text>{button('بستن',()=>setSelected(null),true)}</View><Text style={s.subtitle}>عضویت: {dates(selected.consent_at)} • آخرین همگام‌سازی: {dates(selected.synced_at)}</Text>
            {selected.summary && <Text style={s.detail}>{fa(progressMetrics(selected.summary).lessons)} درس تکمیل‌شده   ·   {fa(progressMetrics(selected.summary).words)} واژه معرفی‌شده   ·   {fa(progressMetrics(selected.summary).minutes)} دقیقه ثبت‌شده</Text>}
            <Text style={s.small}>این داده‌ها گزارش دستگاه‌اند، نه آزمون تسلط یا سنجش حضور. توقف گزارش، اپ یا درس‌های آفلاین را قفل نمی‌کند.</Text>
            {button(selected.status==='active' ? 'توقف دریافت گزارش این عضو' : 'فعال‌کردن دوباره گزارش', () => void task(async () => {
              const { error }=await adminClient().from('education_enrollments').update({status:selected.status==='active'?'paused':'active'}).eq('student_id',selected.student_id).select('student_id');
              if(error) throw error;await refresh();setNotice('وضعیت گزارش به‌روزرسانی شد.');
            }), true, demo)}
          </View>}
        </>}
        {tab === 'invites' && <View style={s.card}>
          <Text style={s.cardTitle}>دعوت آموزشی جدید</Text><Text style={s.subtitle}>دعوت یک‌بارمصرف با اعتبار ۷ روز. این کد با کد دعوت مکالمه فرق دارد.</Text>
          <TextInput accessibilityLabel="عنوان دعوت" placeholder="مثلاً: کلاس عصر — سارا" maxLength={80} value={label} onChangeText={setLabel} style={s.input} />
          {button('ساخت دعوت اختصاصی', () => void task(async () => {const {error}=await adminClient().from('education_invites').insert({label:label.trim()});if(error) throw error;setLabel('');await refresh();setNotice('دعوت ساخته شد. کد را فقط به فرد موردنظر بدهید.');}),false,demo || !label.trim())}
          <Text style={s.small}>زبان‌آموز در صفحه «مدیریت اشتراک آموزشی» کد را وارد می‌کند. نام مدیر و رضایت اشتراک پیشرفت قبل از عضویت نمایش داده می‌شود.</Text>
          {!invites.length && <Text style={s.emptyText}>{demo ? 'برای ساخت دعوت واقعی وارد حساب مدیر شوید.' : 'هنوز دعوتی ساخته نشده است.'}</Text>}
          {invites.map(inv => <View key={inv.id} style={s.inviteRow}><Text style={s.cardTitle}>{inv.label}</Text><Text selectable style={s.code}>{inv.code}</Text><Text style={s.small}>{inv.claimed_at ? 'مصرف‌شده' : Date.parse(inv.expires_at) < Date.now() ? 'منقضی‌شده' : 'آماده استفاده'} · پایان اعتبار: {dates(inv.expires_at)}</Text>{!inv.claimed_at && button('لغو دعوت',()=>void task(async()=>{const {error}=await adminClient().from('education_invites').delete().eq('id',inv.id);if(error) throw error;await refresh();}),true)}</View>)}
        </View>}
        {tab === 'content' && <View style={s.card}><Text style={s.cardTitle}>کتابخانه محتوای فعلی</Text><Text style={s.subtitle}>{fa(SENTENCE_LESSONS.length)} درس · {fa(SENTENCE_LESSONS.reduce((total, lesson) => total + lesson.sentences.length, 0))} جمله · ۵۰۴ واژه مرجع</Text><Text style={s.small}>این بخش فعلاً فقط خواندنی است. ویرایش و انتشار محتوای جدید از پنل هنوز پیاده‌سازی نشده است.</Text>{COURSE_LEVELS.map(l => <View key={l.id} style={s.contentRow}><View style={[s.levelDot,{backgroundColor:l.color}]} /><View style={{flex:1}}><Text style={s.studentName}>{l.title}</Text><Text style={s.small}>{l.description}</Text></View><Text style={s.badge}>{fa(SENTENCE_LESSONS.filter(x=>x.levelId===l.id).length)} درس</Text></View>)}</View>}
        <View style={s.footer}><ShieldCheck size={16} color="#7a899b" /><Text style={s.small}>مدیریت آموزشی • بدون نظارت بر گوشی • داده آفلاین پس از همگام‌سازی دیده می‌شود</Text></View>
        {Constants.expoConfig?.extra?.appRole !== 'admin' && button('بازگشت به اپ آموزشی',()=>router.replace('/lang'),true)}
      </ScrollView>
    </View>
  </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#F4F8FD'},shell:{flex:1,flexDirection:'row-reverse'},content:{flex:1},sidebar:{width:268,backgroundColor:'#FFFFFF',padding:22,gap:20,borderLeftWidth:1,borderColor:'#DDE9F7',shadowColor:'#1D4E89',shadowOpacity:.07,shadowRadius:16,shadowOffset:{width:-4,height:0},elevation:3},sidebarMobile:{width:108,paddingHorizontal:9,paddingVertical:14,gap:10,borderLeftWidth:1},brand:{flexDirection:'row-reverse',gap:11,alignItems:'center'},brandMobile:{flexDirection:'column',gap:6,justifyContent:'center'},brandTitle:{fontFamily:'Vazir-Bold',fontSize:17,color:'#102A56'},mobileBrandTitle:{fontFamily:'Vazir-Bold',fontSize:12,color:'#102A56',textAlign:'center'},logo:{width:50,height:50,borderRadius:16,backgroundColor:'#1769D2',alignItems:'center',justifyContent:'center',shadowColor:'#1769D2',shadowOpacity:.22,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:4},logoMobile:{width:42,height:42,borderRadius:13},navLabel:{fontFamily:'Vazir',fontSize:11,color:'#98a3b2',textAlign:'right'},navLabelMobile:{textAlign:'center',fontSize:9,marginTop:2},navList:{gap:8},navListMobile:{gap:6},navItem:{flexDirection:'row-reverse',alignItems:'center',gap:11,minHeight:48,paddingHorizontal:14,paddingVertical:11,borderRadius:14},navActive:{backgroundColor:'#EAF3FF',borderWidth:1,borderColor:'#C9DFFF'},navText:{fontFamily:'Vazir-Medium',fontSize:13,color:'#64748B'},navTextActive:{fontFamily:'Vazir-Bold',color:'#1769D2'},mobileNavItem:{minHeight:67,paddingHorizontal:4,paddingVertical:7,flexDirection:'column',justifyContent:'center',gap:5},mobileNavText:{fontFamily:'Vazir',fontSize:10,lineHeight:16,textAlign:'center'},mobileLogout:{minHeight:58,paddingHorizontal:4,paddingVertical:7,flexDirection:'column',justifyContent:'center',gap:4,borderTopWidth:1,borderColor:'#E3ECF7',borderRadius:12},privacy:{backgroundColor:'#F2F7FD',padding:17,gap:10,borderRadius:16,alignItems:'flex-end'},main:{padding:32,gap:20,maxWidth:1280,width:'100%',alignSelf:'center'},mainMobile:{paddingHorizontal:10,paddingVertical:14,gap:12},header:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',borderRadius:24,borderWidth:1,borderColor:'#D7E7FA',padding:22,shadowColor:'#2D6FB7',shadowOpacity:.08,shadowRadius:16,shadowOffset:{width:0,height:7},elevation:3},headerMobile:{padding:14,borderRadius:18,gap:10},eyebrow:{fontFamily:'Vazir',fontSize:11,color:'#8190a2',textAlign:'right',marginBottom:8},title:{fontFamily:'Vazir-Bold',fontSize:26,color:'#102A56',textAlign:'right'},titleMobile:{fontSize:18,lineHeight:30},subtitle:{fontFamily:'Vazir',fontSize:13,color:'#6c7c8e',textAlign:'right',lineHeight:25},pill:{flexDirection:'row-reverse',alignItems:'center',gap:8,backgroundColor:'#fff',borderRadius:25,padding:12},pillMobile:{paddingHorizontal:9,paddingVertical:7},dot:{width:7,height:7,borderRadius:4,backgroundColor:'#1769D2'},pillText:{fontFamily:'Vazir',fontSize:12,color:'#334E68'},demoBanner:{fontFamily:'Vazir',fontSize:12,lineHeight:24,color:'#8b641c',backgroundColor:'#fff5dc',padding:14,borderRadius:12,textAlign:'right'},stats:{flexDirection:'row-reverse',flexWrap:'wrap',gap:14},stat:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DDE9F7',padding:20,borderRadius:20,flex:1,minWidth:170,gap:7,shadowColor:'#2D6FB7',shadowOpacity:.06,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:2},statLabel:{fontFamily:'Vazir',fontSize:13,color:'#788697',textAlign:'right'},statNumber:{fontFamily:'Vazir',fontSize:32,fontWeight:'700',color:'#102A56',textAlign:'right'},small:{fontFamily:'Vazir',fontSize:11,color:'#7d8c9e',textAlign:'right',lineHeight:21},hero:{backgroundColor:'#123E76',padding:26,borderRadius:20,flexDirection:'row-reverse',alignItems:'center',flexWrap:'wrap',gap:22},heroTitle:{fontFamily:'Vazir',fontSize:19,color:'#fff',fontWeight:'700',textAlign:'right',marginBottom:8},heroText:{fontFamily:'Vazir',fontSize:12,color:'#D9E9FF',textAlign:'right',lineHeight:25},card:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DDE9F7',borderRadius:22,padding:22,gap:17,shadowColor:'#2D6FB7',shadowOpacity:.055,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:2},cardTitle:{fontFamily:'Vazir',fontSize:16,fontWeight:'700',color:'#1E293B',textAlign:'right'},sectionHead:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10},toolbar:{flexDirection:'row-reverse',flexWrap:'wrap',gap:12,alignItems:'center'},search:{flex:1,minWidth:190,flexDirection:'row-reverse',alignItems:'center',gap:10,backgroundColor:'#f5f7fa',borderRadius:10,paddingHorizontal:12},searchInput:{flex:1,fontFamily:'Vazir',fontSize:12,textAlign:'right',padding:12,color:'#1E293B'},filters:{flexDirection:'row-reverse',gap:6},filter:{paddingHorizontal:14,paddingVertical:7,borderRadius:8},studentRow:{flexDirection:'row-reverse',alignItems:'center',gap:12,paddingVertical:18,borderTopWidth:1,borderColor:'#edf1f5',flexWrap:'wrap'},avatar:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},avatarText:{fontFamily:'Vazir',fontSize:20,color:'#2878DE'},studentName:{fontFamily:'Vazir',fontSize:13,fontWeight:'700',color:'#123E76',textAlign:'right'},badge:{fontFamily:'Vazir',fontSize:11,color:'#1769D2',backgroundColor:'#EAF3FF',paddingVertical:5,paddingHorizontal:12,borderRadius:8,overflow:'hidden'},track:{height:5,backgroundColor:'#edf2f6',borderRadius:5,marginTop:8,overflow:'hidden',alignItems:'flex-end'},fill:{height:5,backgroundColor:'#2878DE',borderRadius:5},button:{backgroundColor:'#1769D2',minHeight:46,paddingHorizontal:20,paddingVertical:12,borderRadius:14,alignItems:'center',justifyContent:'center'},secondary:{backgroundColor:'#f0f4f7'},buttonText:{fontFamily:'Vazir',color:'#fff',fontSize:12,fontWeight:'700'},input:{fontFamily:'Vazir',fontSize:14,color:'#1E293B',backgroundColor:'#f7f9fb',borderWidth:1,borderColor:'#dce5ed',borderRadius:11,padding:14,textAlign:'right'},ltr:{textAlign:'left'},emailText:{fontFamily:'Vazir',fontSize:11,fontWeight:'700',color:'#7d8c9e',textAlign:'left',writingDirection:'ltr'},label:{fontFamily:'Vazir',fontSize:12,color:'#52667c',textAlign:'right'},loginPage:{flexGrow:1,backgroundColor:'#F2F7FD',alignItems:'center',justifyContent:'center',padding:24},loginCard:{backgroundColor:'#FFFFFF',padding:30,borderRadius:28,width:'100%',maxWidth:520,gap:16,borderWidth:1,borderColor:'#D7E7FA',shadowColor:'#2D6FB7',shadowOpacity:.12,shadowRadius:22,shadowOffset:{width:0,height:10},elevation:5},error:{fontFamily:'Vazir',color:'#aa3030',backgroundColor:'#fff0f0',padding:14,borderRadius:10,textAlign:'right',lineHeight:24},notice:{fontFamily:'Vazir',color:'#1259B5',backgroundColor:'#EAF3FF',padding:14,textAlign:'right',borderRadius:10},empty:{alignItems:'center',padding:30,gap:15},emptyText:{fontFamily:'Vazir',color:'#8090a1',padding:25,textAlign:'center'},detail:{fontFamily:'Vazir',color:'#1259B5',fontSize:14,textAlign:'right',lineHeight:28},inviteRow:{borderTopWidth:1,borderColor:'#e7edf4',paddingTop:18,gap:12},code:{fontFamily:'Vazir-Bold',fontSize:14,color:'#285b86',textAlign:'left',padding:12,backgroundColor:'#f3f7fb',borderRadius:8},contentRow:{flexDirection:'row-reverse',alignItems:'center',gap:16,paddingVertical:18,borderTopWidth:1,borderColor:'#eef2f5'},levelDot:{width:12,height:36,borderRadius:5},footer:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8},
});
