// Language-specific word lists used for query expansion and intent tagging.
// Languages without their own list fall back to English.

export const ALPHABETS = {
  latin: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  ar: 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' '),
}

// Prefixes such as "how age calculator" — Google completes them into real questions.
export const QUESTION_WORDS = {
  en: ['how', 'what', 'why', 'when', 'where', 'which', 'who', 'can', 'is', 'does', 'should', 'are'],
  pt: ['como', 'qual', 'quais', 'quando', 'onde', 'por que', 'quem', 'o que', 'quanto'],
  es: ['cómo', 'qué', 'cuál', 'cuándo', 'dónde', 'por qué', 'quién', 'cuánto'],
  de: ['wie', 'was', 'warum', 'wann', 'wo', 'welche', 'wer', 'kann'],
  fr: ['comment', 'quel', 'quelle', 'pourquoi', 'quand', 'où', 'qui', 'combien'],
  it: ['come', 'cosa', 'perché', 'quando', 'dove', 'quale', 'chi', 'quanto'],
  nl: ['hoe', 'wat', 'waarom', 'wanneer', 'waar', 'welke', 'wie'],
  ar: ['كيف', 'ما', 'ماذا', 'لماذا', 'متى', 'أين', 'هل', 'كم'],
  id: ['cara', 'apa', 'bagaimana', 'kenapa', 'kapan', 'dimana', 'berapa'],
  tr: ['nasıl', 'ne', 'neden', 'nerede', 'hangi', 'kim', 'kaç'],
}

// Suffixes that pull out comparison, audience and use-case keywords.
export const CONNECTOR_WORDS = {
  en: ['for', 'with', 'without', 'to', 'near', 'vs', 'or', 'like', 'and', 'in'],
  pt: ['para', 'com', 'sem', 'perto', 'vs', 'ou', 'de', 'no'],
  es: ['para', 'con', 'sin', 'cerca', 'vs', 'o', 'de', 'en'],
  de: ['für', 'mit', 'ohne', 'in der nähe', 'vs', 'oder', 'bei'],
  fr: ['pour', 'avec', 'sans', 'près', 'vs', 'ou', 'de', 'en'],
  it: ['per', 'con', 'senza', 'vicino', 'vs', 'o', 'di', 'in'],
  nl: ['voor', 'met', 'zonder', 'vs', 'of', 'in'],
  ar: ['مع', 'بدون', 'في', 'او', 'من'],
  id: ['untuk', 'dengan', 'tanpa', 'vs', 'atau', 'di'],
  tr: ['için', 'ile', 'olmadan', 'vs', 'veya'],
}

// Intent tagging — single words matched against keyword tokens.
export const INTENT_WORDS = {
  en: {
    question: ['how', 'what', 'why', 'when', 'where', 'which', 'who', 'whom', 'whose', 'can', 'is', 'does', 'do', 'should', 'are', 'will', 'could', 'would'],
    comparison: ['vs', 'versus', 'or', 'compared', 'compare', 'comparison', 'difference', 'alternative', 'alternatives', 'better'],
    commercial: ['best', 'top', 'cheap', 'cheapest', 'free', 'price', 'prices', 'pricing', 'cost', 'costs', 'review', 'reviews', 'buy', 'deal', 'deals', 'discount', 'coupon', 'coupons', 'sale', 'app', 'apps', 'download', 'premium', 'affordable'],
    local: ['near', 'nearby', 'nearest', 'local', 'delivery'],
  },
  pt: {
    question: ['como', 'qual', 'quais', 'quando', 'onde', 'porque', 'por', 'quem', 'quanto', 'pode', 'é'],
    comparison: ['vs', 'versus', 'ou', 'diferença', 'comparação', 'alternativa', 'melhor que'],
    commercial: ['melhor', 'melhores', 'barato', 'grátis', 'gratis', 'preço', 'precos', 'preços', 'comprar', 'promoção', 'desconto', 'app', 'baixar'],
    local: ['perto', 'próximo', 'proximo', 'delivery'],
  },
  es: {
    question: ['cómo', 'como', 'qué', 'que', 'cuál', 'cual', 'cuándo', 'dónde', 'donde', 'quién', 'cuánto', 'cuanto', 'puedo', 'es'],
    comparison: ['vs', 'versus', 'o', 'diferencia', 'comparación', 'alternativa'],
    commercial: ['mejor', 'mejores', 'barato', 'gratis', 'precio', 'precios', 'comprar', 'oferta', 'descuento', 'app', 'descargar'],
    local: ['cerca', 'cercano', 'domicilio'],
  },
  de: {
    question: ['wie', 'was', 'warum', 'wann', 'wo', 'welche', 'welcher', 'wer', 'kann', 'ist'],
    comparison: ['vs', 'oder', 'unterschied', 'vergleich', 'alternative'],
    commercial: ['beste', 'besten', 'günstig', 'kostenlos', 'preis', 'preise', 'kaufen', 'angebot', 'test', 'app'],
    local: ['nähe', 'umgebung', 'lieferung'],
  },
  fr: {
    question: ['comment', 'quel', 'quelle', 'quels', 'pourquoi', 'quand', 'où', 'qui', 'combien', 'est'],
    comparison: ['vs', 'ou', 'différence', 'comparatif', 'alternative'],
    commercial: ['meilleur', 'meilleure', 'pas cher', 'gratuit', 'prix', 'acheter', 'promo', 'avis', 'app'],
    local: ['près', 'proche', 'livraison'],
  },
  ar: {
    question: ['كيف', 'ما', 'ماذا', 'لماذا', 'متى', 'أين', 'هل', 'كم', 'من'],
    comparison: ['او', 'أو', 'مقارنة', 'الفرق', 'بديل'],
    commercial: ['افضل', 'أفضل', 'رخيص', 'مجاني', 'سعر', 'اسعار', 'أسعار', 'شراء', 'عروض', 'خصم', 'تحميل'],
    local: ['قريب', 'توصيل'],
  },
}

export const LOCAL_PHRASES = ['near me', 'open now', 'perto de mim', 'cerca de mi', 'in der nähe', 'près de moi', 'بالقرب مني']

// Filler words ignored when finding new words and topics.
export const STOPWORDS = {
  en: 'a an the and or of to in on at for with without by from as is are was be it its this that these those my your our their me i you we they he she his her them what how why when where which who can does do should will vs versus near best top free online'.split(' '),
  pt: 'a o as os um uma de do da dos das e ou em no na nos nas para por com sem que se é como qual quais quando onde quem o que vs melhor'.split(' '),
  es: 'el la los las un una de del y o en para por con sin que se es como cómo qué cuál cuando dónde quién vs mejor'.split(' '),
  de: 'der die das den dem des ein eine und oder in im am an auf für mit ohne von zu ist wie was warum wann wo welche wer vs beste'.split(' '),
  fr: 'le la les un une des de du et ou en dans pour par avec sans que qui est comment quel quelle pourquoi quand où vs meilleur'.split(' '),
  it: 'il lo la i gli le un una di del della e o in per con senza che è come cosa perché quando dove quale chi vs migliore'.split(' '),
  nl: 'de het een en of in op voor met zonder van te is hoe wat waarom wanneer waar welke wie vs beste'.split(' '),
  ar: 'في من على الى إلى عن مع او أو و ما ماذا كيف هل لماذا متى أين كم'.split(' '),
  id: 'di ke dari dan atau yang untuk dengan tanpa ini itu apa cara bagaimana kenapa kapan dimana berapa vs'.split(' '),
  tr: 've veya ile için bir bu şu ne nasıl neden nerede hangi kim kaç vs'.split(' '),
}

export function listFor(table, language) {
  return table[language] ?? table.en
}
