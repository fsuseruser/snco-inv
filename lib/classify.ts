import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/* ---------------------------------------------------------------- phones */

/** Normalises a phone to E.164 (+9715XXXXXXXX). UAE local formats are understood. Returns null if unusable. */
export function normalizePhone(input: string | null | undefined): string | null {
  let d = String(input ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("05")) d = "971" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "971" + d;
  else if (d.length === 9 && /^0[234679]/.test(d)) d = "971" + d.slice(1);
  if (d.startsWith("9710")) d = "971" + d.slice(4);
  if (d.startsWith("971") && !(d.length === 12 || (d.length === 11 && "234679".includes(d[3])))) return null;
  if (d.length < 10 || d.length > 15) return null;
  return "+" + d;
}

export function splitPhones(input: string | null | undefined): string[] {
  if (!input) return [];
  const out = new Set<string>();
  for (const part of String(input).split(/[\/,;|]|\s{2,}|\bor\b|\n/i)) {
    const p = normalizePhone(part);
    if (p) out.add(p);
  }
  return [...out];
}

export function phoneCountry(phone: string | null | undefined): string | null {
  if (!phone) return null;
  try {
    return parsePhoneNumberFromString(phone)?.country ?? null;
  } catch {
    return null;
  }
}

export function formatPhone(phone: string) {
  try {
    const p = parsePhoneNumberFromString(phone);
    return p ? p.formatInternational() : phone;
  } catch {
    return phone;
  }
}

/* ------------------------------------------------------------ name origin */

export const NAME_ORIGINS = [
  "Arab",
  "South Asian",
  "Iranian",
  "Turkish",
  "Russian / CIS",
  "Chinese",
  "East Asian",
  "Filipino / Hispanic",
  "English / Western",
  "European",
] as const;
export type NameOrigin = (typeof NAME_ORIGINS)[number];

const w = (s: string) => new Set(s.trim().split(/\s+/));

const ARAB = w(`mohamed mohammed muhammad mohammad mohamad muhammed mohd ahmed ahmad ali abdulla abdullah abdalla abdallah
  abdul abdel abdulaziz abdulrahman abdulrahim abdulkarim abdulla abdulsalam abdulhadi abdelaziz abdelrahman bin bint
  saeed said saif rashed rashid khalfan khamis obaid sultan hamad hamdan khalifa mubarak juma jumaa hassan hasan hussein
  hussin khalid khaled omar othman osman youssef yousef yousif yusuf ibrahim ismail eisa isa essa moosa musa nasser naser nasr
  saleh salah salem salim sayed sayyed fatima fatema mariam maryam aisha amna mouza moza shaikha sheikha hessa noura alia aliya
  reem latifa maitha meera hind hanan huda asma salma layla laila rania maha nadia samira zainab zeinab mona muna nawal
  amal ghada rasha randa suad wafa abeer fadi rami ziad ziyad tarek walid waleed imad emad nabil nabeel samir karim kareem
  majed faisal fahad fahd turki nawaf mansour mansoor jaber jassim jasim humaid thani zayed yaser yasser haitham hisham hesham
  marwan bassam osama usama wael ayman amr amro hazem mahmoud mustafa mostafa adel aadel adil anas ammar jamal nizar ghassan
  raed riad riyad sami tamer tamim yahya zaid ghanem saqr saqer sager matar mohsen naji abu bu haddad khoury khouri nassar saad
  saab sabbagh karam hanna boutros butros gemayel aoun azar abboud akl daher fakhoury hajj haj khalil maalouf nasrallah rizk
  salameh shammas tannous yammine zein kassab ghosn sleiman bitar srour harb chidiac chalhoub nakhle nehme girgis guirguis
  shenouda tadros wassef iskander farouk farag fouad fuad ashraf hosni hamza hatem raafat sherif shereef ehab tawfik magdy
  medhat nour noor eman iman heba dalia nermeen nesreen ghadeer hala lubna sawsan bushra ruba dima lama shatha thuraya
  mazrouei mazrouie mazrooei nuaimi qubaisi shamsi dhaheri ketbi zaabi hosani hammadi mansoori marzooqi suwaidi blooshi
  balooshi ameri muhairi rumaithi remeithi falasi mehairbi neyadi kaabi mheiri hameli jneibi shehhi tunaiji yahyaei
  qemzi qamzi alawi hashimi hashemi hussain yasin yassin yassine amin amine mazin mazen nasreen fares faris galal gamal
  hiam elias elie hani hoda basheer bashir alaa helmy akram islam mouafak muwaffaq adnan manal dina dhari moataz motaz imane
  nawel nawal hicham mounir abdelali mourad nadir rachid rachida karima youssef mokbel anwar hossam hossameddin hussni
  esmaeel ismaeel rafik rafiq rafeeq jihad jihan nidal nizam sabah sabri samer sameh shadi tarik wissam zakaria zakariya
  zuhair zouhair zoheir chafic chafik claude ghazi habib hamid hamed hamdi husam issam jalal jamil jameel kamel kamil khaldoun
  khalil louay loay maher mazen mohanad muhannad mouhanad nabih nader nadim naim nasir nassim omran qasim qassem raef rafat
  ramez ramzi rashad riyadh saber saddam safwan said salman samih sufian suleiman sulaiman taha talal tamer tarek wajdi yazan
  younes younis yunus zaher abdelkader abdelhamid abdelkarim abdelmajid abdelilah abdeslam mustapha mohcine ouafae fatiha
  khadija hafida houda latifa malika naima najat rabia saida souad zineb ilham asmaa nouha rim sana ranya razan reema roula
  ruba sahar samar sanaa siham suha wafaa yasmine zeina abir afaf amira azza dalal doaa eman fadwa ghalia hayat inas inaam
  jumana kholoud lamia lamya maysa mayssa nada nahla najla nisreen ola rana rawan rola shaimaa tagreed wedad aad abi abou bou
  hannouche jabbour nubani muqatash khaldy ghantous saffar binjaafar asfour zoghaib barakat kansou makarem shakra tahhan
  mokaddem doukan hamouda shehada abuawwad abubaker fraiwat ibdah jabalee adwan zuarub fahmi mosleh jafar jaafar sourial
  aouad chedid hayani merabet benmeriem remch elayadi sahel bouchenak kyerallah baassiri oueis alanqar`);

const SOUTH_ASIAN_STRONG = w(`kumar singh sharma patel gupta reddy nair menon pillai iyer iyengar rao krishnan agarwal aggarwal
  bansal kapoor khanna malhotra chopra verma varma mishra pandey tiwari dubey yadav chauhan thakur naidu chowdhury chaudhary
  choudhary chaudhry banerjee chatterjee mukherjee ghosh bose dutta saxena srivastava sinha prasad nambiar kurian varghese
  chacko subramanian venkatesh ramesh suresh mahesh ganesh rajesh dinesh rakesh mukesh naresh sunil anil vijay ajay sanjay
  vinod pradeep sandeep deepak ashok arun ravi sachin rahul amit sumit rohit vikas vikram manoj santosh satish girish harish
  prakash priya pooja neha anjali deepa divya kavita lakshmi meena sunita anita rekha shweta swati nisha preeti ritu kiran
  gopal gopi hari nitin pankaj rajiv sanjeev shankar shiva srinivas sridhar sudhir uday vasudevan venkat vivek yogesh
  abhishek aditya akshay anand ankit ashish gaurav hemant jitendra mohan naveen nikhil piyush rajendra sudhakar tarun varun
  vinay veettil puthiya kunhi koya thayyil parambil kandy kutty kunju ullah uddin khan hossain miah begum bibi qureshi
  siddiqui iqbal akhtar javed asif imran rizwan shahid sajid zahid waqas usman farooq ahsan mirza baig rehman shaikh
  dsouza d'souza dcosta d'costa dsilva d'silva dmello d'mello dcruz d'cruz menezes bhatia mehta desai joshi jain shah bhatt
  bhat sethi arora ahuja grover gill sandhu sidhu dhillon kaur raj rajan das sen roy chandran nandakumar
  sasidharan unnikrishnan gopinath radhakrishnan balakrishnan ramachandran muhammedali muhammadali abdulkader abdulkhader
  kader khader rahiman saheb sahib bhai`);
const SOUTH_ASIAN_WEAK = w(`thomas abraham mathew joseph george philip jose rahman hussain malik tariq bilal haider raza ali`);

const IRANIAN = w(`hosseini hossein mohammadi rezaei karimi jafari ahmadi moradi sadeghi rahimi ghorbani kazemi mousavi musavi
  shirazi tehrani esfahani akbari sharifi reza mehdi behzad babak farhad shahram siamak arash dariush kourosh parisa
  fereshteh shirin nasrin azadeh golnaz roya mehrdad behrouz bahram farzad payam pejman peyman afshin ramin navid omid vahid
  nima alireza mohammadreza hamidreza gholam gholamreza mojtaba morteza mahnaz mahsa negar niloufar pegah sepideh soheil
  shahin kian keyvan farshid fariba mitra taghi naghi`);
const IRANIAN_ENDINGS = /(zadeh|zade|pour|poor|nejad|nezhad|fard|abadi|vand)$/;

const TURKISH = w(`yilmaz kaya demir sahin celik yildiz yildirim ozturk aydin ozdemir dogan kilic aslan cetin koc
  ozkan simsek polat erdogan ozcan akin mehmet ahmet ayse emre burak murat hakan serkan cem ozan onur oguz kemal gokhan
  tolga volkan baris umut elif zeynep ebru sibel ozge tugba berk mert kaan ugur levent`);
const TURKISH_ENDINGS = /(oglu|ogullari|oğlu)$/;

const RUSSIAN_FIRST = w(`dmitry dmitri dmitrii sergey sergei andrei andrey vladimir igor oleg olga natalia natalya tatiana tatyana
  svetlana yulia yuliya ekaterina irina anastasia maxim maksim alexey aleksey aleksandr nikolai nikolay yuri yury evgeny evgeniy
  evgenii pavel anton artem artyom ivan mikhail georgii vadim ruslan timur rustam ksenia oksana viktor viktoriia viktoriya
  lyudmila galina larisa nadezhda valentina kirill konstantin stanislav vyacheslav gennady gennadiy arkady boris leonid gleb ilya
  daria darya polina elena alena alyona inna zhanna marina vera lyubov anzhelika nikita yaroslav vsevolod bogdan taras vitaly
  vitaliy aleksandra aleksandrovna denis roman`);
const RUSSIAN_ENDINGS = /(ov|ova|ev|eva|yev|yeva|enko|sky|skiy|skii|skaya|vich|vna|yan|ich|uk|chuk|yuk|in|ina|ikh|ykh|aev|aeva|bekov|bekova|baev|baeva)$/;

const CHINESE_SURNAMES = w(`wang li zhang liu chen yang huang zhao wu zhou xu sun zhu hu guo he lin gao luo zheng liang xie song
  tang feng deng cao peng zeng xiao tian dong pan yuan cai jiang yu du ye cheng wei su lu ding ren shen yao cui zhong tan fan
  qian qin shi jin dai xue hou lei long duan hao kong shao meng qiu bai mao jia gu xiong wan qiao lai fu fang chan cheung chow
  chung lam lau leung ng tsang wong yip yeung kwok`);
const PINYIN = /^(?:(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ueng|ang|eng|ing|ong|ian|iao|uai|uan|ai|ei|ao|ou|an|en|in|un|ia|ie|iu|ua|uo|ui|ue|er|a|o|e|i|u|v)){1,2}$/;

const EAST_ASIAN = w(`kim park choi jung jeong kang cho yoon jang lim shin seo kwon hwang ahn yoo baek tanaka suzuki sato
  takahashi watanabe ito yamamoto nakamura kobayashi kato yoshida yamada sasaki matsumoto inoue kimura hayashi shimizu mori
  ikeda nguyen tran pham hoang phan vu vo dang bui ngo duong`);
const KOREAN_GIVEN = /^(ji|min|hyun|seung|jae|young|sung|woo|joon|hoon|eun|soo|hye|jin|ho|kyung|dong|sang|chul|yeon|hee|won)/;

const FILIPINO_STRONG = w(`dela delos macapagal villanueva bautista aquino manalo dizon pascual soriano mercado dimaculangan
  magbanua cruz reyes santos ramos flores mendoza castillo gonzales tolentino navarro aguilar salazar domingo cabrera
  rodel jayson maricel marilou rowena jocelyn analyn rommel arnel edgardo`);
const HISPANIC = w(`garcia fernandez rodriguez martinez lopez sanchez perez gomez diaz hernandez gonzalez torres ramirez
  rivera morales ortiz jimenez ruiz alvarez romero vargas castro`);

const ENGLISH_FIRST = w(`john james david michael robert william richard mark paul peter andrew stephen steven christopher chris
  matthew simon nicholas nick jonathan ian graham neil gary kevin brian sean patrick anthony tony charles edward henry jack harry
  oliver sarah emma emily jessica jennifer elizabeth catherine katherine karen susan helen claire rachel rebecca laura lisa
  nicola louise victoria charlotte lucy amanda joanne julie kate jane alison alan colin craig darren dean derek duncan gavin
  gordon keith martin nigel roger ross russell scott stuart trevor wayne ben benjamin samuel luke ryan jason justin
  brandon tyler joshua aaron eric frank gregory jeffrey kenneth larry raymond ronald timothy tim mike joe bill bob rob rick
  steve dave andy matt will tom jim jamie jenny nicole michelle stephanie melissa heather amy angela linda barbara margaret
  deborah debbie carol sharon donna ruth kelly christine diane ann anne frances gillian fiona kirsty hannah megan sophie chloe
  holly natalie zoe abigail daniel george philip joseph thomas`);
const ENGLISH_SUR = w(`smith jones williams brown taylor davies evans wilson johnson roberts robinson thompson wright walker white
  edwards hughes green hall lewis harris clarke clark jackson wood turner cooper hill ward morris moore king baker harrison
  morgan allen scott phillips watson davis parker price bennett young griffiths mitchell kelly cook carter richardson bailey
  collins bell shaw murphy miller cox richards marshall anderson simpson ellis adams wilkinson foster chapman powell webb
  rogers gray grey mason hunt campbell matthews owen palmer holmes mills barnes knight lloyd butler russell barker fisher
  stevens jenkins murray dixon harvey graham pearson fletcher walsh gibson howard andrews stewart elliott reynolds saunders
  payne fox ford pearce brooks lawrence cole atkinson bradley spencer dawson ball burton watts rose booth perry ryan grant
  wells armstrong francis rees hayes hart hudson newman barrett webster hunter gregory carr lowe page marsh riley dunn woods
  parsons berry stone reid holland hawkins harding porter robertson newton reed kennedy williamson bird gardner lane cooke
  bates henderson parry burgess bishop walton burns nicholson shepherd ross cross long freeman warren nicholls hamilton byrne
  sutton yates hodgson robson curtis hopkins harper coleman watkins moss chambers griffin sharp hardy wheeler potter osborne
  johnston gordon doyle wallace jordan hutchinson rowe burke pritchard gilbert willis higgins miles stevenson hammond arnold
  buckley walters hewitt barber nelson slater austin sullivan whitehead frost lambert stephens blake lynch goodwin barton
  woodward thomson cunningham quinn barnett baxter clayton nash greenwood jennings holt kemp poole gallagher bond stokes tucker
  davidson fowler heath norman middleton lawson banks french stanley jarvis gibbs ferguson hayward carroll moran fraser
  sinclair morrison cameron black martin`);

const EUROPEAN = w(`muller mueller schmidt schneider fischer weber meyer wagner becker schulz hoffmann koch richter klein wolf
  schroder neumann schwarz zimmermann braun kruger hartmann lange werner krause lehmann kohler maier huber jean pierre jacques
  francois philippe olivier laurent christophe stephane sebastien frederic thierry julien guillaume antoine mathieu alain
  bernard michel didier pascal yves marie isabelle nathalie sandrine celine aurelie valerie sylvie dubois durand lefebvre leroy
  moreau fournier girard bonnet dupont fontaine rousseau blanc guerin faure mercier boyer chevalier legrand gauthier perrin
  clement morin dumont lemaire rossi russo ferrari esposito bianchi romano colombo ricci marino greco bruno gallo conti
  giordano rizzo lombardi moretti giuseppe giovanni marco luca francesco alessandro matteo lorenzo stefano paolo massimo
  roberto fabio gianluca simone davide federico riccardo jansen jong vries dijk bakker visser smit meijer mulder lars anders
  erik nils sven magnus georgios dimitrios konstantinos nikolaos silva ferreira pereira oliveira costa rodrigues sousa
  goncalves alves almeida ribeiro carvalho teixeira moreira correia vieira hans klaus jurgen wolfgang stefan thomas andreas
  markus christian tobias florian sabine petra ursula monika selma`);
const EUROPEAN_ENDINGS = /(mann|ini|elli|etti|ucci|otti|opoulos|akis|idis|sson|ski|ska|wicz|czyk|ovic|ović|ic|eira|ault|eau)$/;

const ARAB_PREFIX_OK = /^(al|el)[a-z]{3,}/;
const NOT_ARAB_AL = w(`alan alex alexander alexandra alexey alexei alice alison alina alberto albert alfred alessandro alvaro alma
  alba allan allen alicia alla aleksandr aleksey aleksandra alfonso alfredo alberta alena alyona alisa elena ella ellen ellie
  elizabeth elliott elliot elmer elsa elsie elton elvis elif`);

function tokens(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[&/].*$/, "") // first owner of a joint name
    .replace(/\b(mr|mrs|ms|miss|dr|eng|engr|sheikh|shaikh|sh|h\.e)\b\.?/g, " ")
    .replace(/[^a-z' -]/g, " ");
  return base.split(/[\s-]+/).map((t) => t.replace(/^'+|'+$/g, "")).filter((t) => t.length > 1);
}

/** Best guess of where a name comes from. It is an estimate for segmentation, never a fact about the person. */
export function nameOrigin(name: string | null | undefined): NameOrigin | null {
  if (!name) return null;
  if (/[؀-ۿ]/.test(name)) return "Arab";
  if (/[一-鿿]/.test(name)) return "Chinese";
  if (/[Ѐ-ӿ]/.test(name)) return "Russian / CIS";
  const t = tokens(name);
  if (!t.length || (t.length === 1 && t[0] === "unnamed")) return null;

  const score: Record<string, number> = {};
  const add = (k: NameOrigin, v: number) => (score[k] = (score[k] || 0) + v);
  const last = t.length - 1;

  // Chinese: every token pinyin-like and a known surname present
  if (t.length <= 4 && t.every((x) => PINYIN.test(x) || CHINESE_SURNAMES.has(x)) && t.some((x) => CHINESE_SURNAMES.has(x))) {
    add("Chinese", 6);
  }
  t.forEach((x, i) => {
    const wt = i === last ? 2 : i === 0 ? 1.5 : 1;
    if (ARAB.has(x)) add("Arab", wt);
    if (x === "al" || x === "el" || x === "bin" || x === "bint" || x === "abu" || x === "bu") add("Arab", 1.5);
    if (x.length > 4 && ARAB_PREFIX_OK.test(x) && !NOT_ARAB_AL.has(x)) add("Arab", i === last ? 2 : 1.5);
    if (/^abd/.test(x)) add("Arab", 1.5);
    if (SOUTH_ASIAN_STRONG.has(x)) add("South Asian", wt * 2);
    if (SOUTH_ASIAN_WEAK.has(x)) add("South Asian", wt * 0.5);
    if (/(ullah|uddin|deen|bhai)$/.test(x) && x.length > 5) add("South Asian", 2);
    if (/(kumar|prasad|endra|esh|ish|ani|jee|ji)$/.test(x) && x.length > 4 && !ARAB.has(x) && !RUSSIAN_FIRST.has(x)) add("South Asian", 1.2);
    if (x === "ben" && i > 0) add("Arab", 1.5);
    if (IRANIAN.has(x)) add("Iranian", wt * 1.6);
    if (x.length > 5 && IRANIAN_ENDINGS.test(x)) add("Iranian", i === last ? 2.5 : 1);
    if (TURKISH.has(x)) add("Turkish", wt * 1.6);
    if (TURKISH_ENDINGS.test(x)) add("Turkish", 3);
    if (RUSSIAN_FIRST.has(x)) add("Russian / CIS", wt * 1.5);
    if (i === last && t.length > 1 && x.length > 4 && RUSSIAN_ENDINGS.test(x) && !ARAB.has(x) && !ENGLISH_SUR.has(x) &&
        !SOUTH_ASIAN_STRONG.has(x) && !SOUTH_ASIAN_WEAK.has(x) && !(/(in|ina)$/.test(x) && x.length < 6)) {
      add("Russian / CIS", /(in|ina|ich|uk|yan)$/.test(x) ? 1.5 : 3);
    }
    if (EAST_ASIAN.has(x)) add("East Asian", i === last || i === 0 ? 2.5 : 1);
    if (KOREAN_GIVEN.test(x) && x.length <= 7 && t.some((y) => EAST_ASIAN.has(y))) add("East Asian", 1);
    if (FILIPINO_STRONG.has(x)) add("Filipino / Hispanic", wt * 1.5);
    if (HISPANIC.has(x)) add("Filipino / Hispanic", wt * 1.2);
    if (ENGLISH_FIRST.has(x)) add("English / Western", i === 0 ? 1.5 : 0.5);
    if (ENGLISH_SUR.has(x) && i > 0) add("English / Western", i === last ? 2 : 0.8);
    if (/^(mc|mac|o')[a-z]{3,}/.test(x) && i === last) add("English / Western", 2);
    if (EUROPEAN.has(x)) add("European", wt * 1.3);
    if (x.length > 5 && EUROPEAN_ENDINGS.test(x) && i === last) add("European", 1.5);
  });
  // Western first name with an Arab/South Asian/Iranian surname: the surname decides
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 1.5) return null;
  if (ranked[1] && ranked[1][1] === ranked[0][1]) {
    // tie: prefer the origin of the surname
    const s = t[last];
    for (const [k] of ranked.slice(0, 2)) {
      if (k === "Arab" && ARAB.has(s)) return "Arab";
      if (k === "South Asian" && SOUTH_ASIAN_STRONG.has(s)) return "South Asian";
    }
  }
  return ranked[0][0] as NameOrigin;
}

/* -------------------------------------------------------- country names */

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code: string | null | undefined) {
  if (!code) return "Unknown";
  try {
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}
export function flag(code: string | null | undefined) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

/* ------------------------------------------------------- institutions */

export const INSTITUTION_RE =
  /(\bl\.?\s?l\.?\s?c\b|\bpjsc\b|p\.j\.s\.c|\bltd\b|\blimited\b|\bfze\b|\bfzco\b|\bfz\b|\bbank\b|\bproperties\b|\bproperty (management|services|mng)|\bholdings?\b|\binvestments?\b|real estate|\bcompany\b|\bco\.|\bgroup\b|\btrading\b|\bestablishment\b|\bdevelopment\b|\bdevelopers?\b|\bcapital\b|\bfund\b|\btrust\b|\bfoundation\b|\bgovernment\b|\bauthority\b|\bdepartment\b|\bcouncil\b|\bcourt\b|\bministry\b|\bcorporation\b|\bcorp\b|\binc\b|\bplc\b|\bpartners\b|\bventures\b|\bmanagement\b|\bservices\b|\bcontracting\b|\benterprises\b|\bfinance\b|\bsecurities\b|\bm\/s\b|\bstaff\b|\bsorouh\b|\btamouh\b|\bimkan\b|\baldar\b|\bsal\b|\bs\.a\b|\bgmbh\b|\bengineering\b|\borganization\b|\bcharitable\b|\baffairs\b|\bemirate of\b|\badnoc\b|\bschool\b|\buniversity\b|\bhospital\b|\bclinic\b|\bhealthcare\b)/i;
export const PLACEHOLDER_RE =
  /^(v+i+p+|v\.i\.p\.?|name|n\/?a|na|nil|none|null|test|unknown|owner|tbc|tba|x+|-+|\.+|client|customer|buyer)$/i;
