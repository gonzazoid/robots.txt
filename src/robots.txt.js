var Robots = function(body){
    if("object" === typeof body){
        this.rules = "rules" in body ? body.rules : body;
    }else{
    var stocks = {};
    var result = {"bots": {}, "common": {}};
//{{{ directives
    var directives = {
//{{{ user-agent
        "user-agent": function(argv){
            //console.log("user-agent directive: ", argv);
	    //смотрим сток директив - если есть обработанные - то все они к предыдущему набору агентов.
	                                                     //переносим весь сток директив для агентов, указанных в стоке агентов
	    //заносим агента в сток агентов
	    //if(("allow" in stocks) || ("disallow" in stocks) || ("delay" in stocks) || ("visits" in stocks)){
	    var check = function(cV){
                return cV in stocks;
	    };
	    var watchs = ["allow", "disallow", "crawl-delay", "visit-time", "request-rate", "unresolved"];
	    if(watchs.some(check)){
                //перед переносом: мы ориентировочно уже знаем версию протокола, пробуем транслировать allow и disallow в regex-ы
                if(!("version" in stocks)) stocks.version = "1.0"; 
		//не надо парсить регексы - это задача для прогона по allow/disallow
		if("allow" in stocks) stocks.allow = stocks.allow.map(translateRegexp, stocks.version);
		if("disallow" in stocks) stocks.disallow = stocks.disallow.map(translateRegexp, stocks.version);

                //переносим данные в результат
                //if(stocks.version === "") stocks.version = "1.0";
		//TODO если ни одного агента не указано - ошибка или warning
                if("agents" in stocks){
                    while(stocks.agents.length){
                        var agent = stocks.agents.pop();
		        if(!(agent in result.bots)){
                            result.bots[agent] = stocks; 
		        }
		        else{
                            //правила для бота написаны в нескольких местах, генерим warning и смотрим, не противоречат ли они друг другу
		        }
		    }
		    delete(stocks.agents);
		}else{
                    //warning - есть какие либо директивы но не указан ни один user-agent
		}
		stocks = {};
	    }
	    if(!("agents" in stocks)) stocks.agents = [];
	    stocks.agents.push(argv);
	},
//}}}
//{{{ allow
	"allow": function(argv){
            //console.log("allow directive: ", argv);
	    //для пустого правила - особая обработка
            if(argv === null || argv === "") directives.disallow("/");
	    else{
	        if(!("allow" in stocks)) stocks.allow = [];
	        stocks.allow.push(argv);
	    }
	},
//}}}
//{{{ disallow
	"disallow": function(argv){
            //console.log("disallow directive: ", argv);
            if(argv === null || argv === "") directives.allow("/");
	    else{
	        if(!("disallow" in stocks)) stocks.disallow = [];
	        stocks.disallow.push(argv);
	    }
	},
//}}}
//{{{ robot-version
	"robot-version": function(argv){
            //console.log("robot version directive: ", argv);
	    if("version" in stocks){
                //два раза указана версия в одном наборе правил - отклонение от стандарта, игнорируем
		//TODO генерить warning
	    }else{
                stocks.version = argv;
	    }
	},
//}}}
//{{{ request-rate
	"request-rate": function(argv){
            //console.log("request rate directive: ", argv);
            if(!("request-rate" in stocks)) stocks["request-rate"] = [];
	    stocks["request-rate"].push(argv);
	},
//}}}
//{{{ visit-time
	"visit-time": function(argv){
		//TODO если директива указана до упоминания ботов - предполагаем что межсекционная. Учесть так же в методе canInow и whenIcan
            //console.log("visit time directive: ", argv);
            if(!("visit-time" in stocks)) stocks["visit-time"] = [];
	    stocks["visit-time"].push(argv);
	},
//}}}
//{{{ crawl-delay
	"crawl-delay": function(argv){
		//не стандарт
            //console.log("crowl delay directive: ", argv);
	    //TODO вообще надо кидать warning если явно указана вторая версия стандарта
	    if("crawl-delay" in stocks){
                //TODO ошибка, дважды указан delay
	    }else{
		stocks["crawl-delay"] = argv;
	    }
	},
//}}}
	"comment": function(argv){
            //console.log("comment directive: ", argv);
	},
//{{{ sitemap
	"sitemap": function(argv){
	    //не стандарт, упоминается яндексом
            //console.log("sitemap directive: ", argv);
            if(!("sitemap" in result)) result.sitemap = [];
            result.sitemap.push(argv);
	},
//}}}
//{{{ host
	"host": function(argv){
		//не стандарт, упоминается яндексом
            //console.log("host directive: ", argv);
	    if("host" in result.common){
                //ошибка, директива host дожна быть только одна
	    }else{
                result.common.host = argv;
	    }
	},
//}}}
	"clean-param": function(argv){
		//не стандарт, упоминается яндексом
            //console.log("clean param directive: ", argv);
	}
    };
//}}}
    var unresolved = function(argv){
        //console.log("unresolved: ", argv);
	if(!("unresolved" in stocks)) stocks.unresolved = [];
        stocks.unresolved.push(argv);
    }; 
//{{{ parser toolchain
    var translateRegexp = function(rule, version){
	// если просто строка - не переводим в регекс а смотрим на совпадение с заданным путем если совпадение есть и оно с первой позиции - то попали
	// если строка заканчивается на * а начинается на / (полный путь) - убираем, она подразумевается как при обработке строк, так и регулярок
	//но надо проверить, не экранирована ли *
	if(rule[0] === "/" && rule[rule.length-1] === "*") rule = rule.substring(0, rule.length - 1);
	//rule = rule.replace(/([^\\])\*$/g, "$1"); //это неправильная проверка - на такое \\* сработает как на экранированную *,
		                                  //но с другой стороны - такие конструкции лучше разбирать парсером
	//console.log(rule, ": ", detectRegexp(rule));
        return detectRegexp(rule) ? parseRegex(rule) : rule;
    };
    var detectRegexp = function(rule){
        //ок, как определяем регулярку?
	//1 - относительный путь (без / в начале)
	//2 - использование спецсимволов - *, ?, [], 
	    //с вопросительным знаком - беда!!!
	//пустое правило обрабатывается как регулярка
	//TODO yandex понимает $ в конце строки
	
	if(!rule.length) return true;
	switch(true){
            case rule[0] !== "/": return true;
	    case /[\*\[\]]/.test(rule): return true;
	}
        return false;
    };
    var parseRegex = function(rule){
        //пробуем привести rule к javascript нотации (* меняем на .* и все такое)
        // если нет экранирующего слеша - \ меняем автоматом
	//DONE скобки для захвата совпадения (не нужны - полное совпадение и так возвращается match)
        if(~rule.indexOf("\\")){
            //есть экран
        }else{
	    //DONE надо экранировать точки
	    //TODO надо экранировать скобки - надо ли? проверить, могут ли они появиться там, и если появились - не являются ли частью регекса
	    //TODO yandex понимает $ в конце строки
            var pattern = rule.replace("\.", "\\\.")
	                      .replace("*", ".*");
	    if(pattern[0] === "/") pattern = "^" + pattern;
	    var reg = new RegExp(pattern, "g");
	    //console.log(reg);
            return reg;
	}
        //return rule;
    };
    var nop = function(){
        //console.log("nop");
    };
    var removeComments = function(cV){
        var commentRegex = /(^|\s+)#.*$/;
	return cV.replace(commentRegex, "");
    };
    var splitLine = function(line) {
	    //вообще то надо учитывать что между директивой и : не должно быть пробелов а после : пробел обязательно должен быть
        var idx = String(line).indexOf(':');
	//TODO то что null - надо в unresolved
        return (!line || idx < 0) ? null : [line.slice(0, idx), line.slice(idx + 1)];
    };

    var trimLine = function(line) {
        switch(true){
            case !line : return null;
            case Array.isArray(line): return line.map(trimLine);
            default: return String(line).trim();
	}
    };
    var tokenizer = function(pair){
        if(!pair) return [nop, null];
	return [pair[0].toLowerCase() in directives ? directives[pair[0].toLowerCase()] : unresolved, pair[1]];
    };
//}}}  
    //для начала разобъем по строкам
    var newlineRegex = /\r\n|\r|\n/;
    var objCode = body
                    .split(newlineRegex)
                    .map(removeComments)
                    .map(splitLine)
                    .map(trimLine)
		    .map(tokenizer);
    //console.log(objCode);

    if(objCode.length){
        while(objCode.length){
            objCode[0][0](objCode[0][1]);
	    objCode.shift();
        }
	directives['user-agent'](""); // перенесем последние директивы
    }else{
        //ничего не вышло, закругляемся
    }
    //^каждый хандлер директивы делает шифт objCode и кладет результат в последний объект массива. если остался один елемент - это и есть результат, он возвращается
    //console.log(JSON.stringify(result, null, "  "));
    this.rules = "rules" in result ? result.rules : result;
    }
};
//{{{ prototype.allow
    //TODO пустой disallow - разрешает все, пустой allow - запрещает все
    Robots.prototype.isAllowed = function(request){
        //console.log("allow: ", request);
	var match = function(rule){
            //this - проверяемый путь
            //если rule - строка, то просто совпадение с начала, иначе - регекс, чуть более подробно
            switch(typeof rule){
                case "string":
		    var offs = this.indexOf(rule);
                    return rule[0] === "/" ? ( offs === 0 ?  rule : "")
                                             //^правило совпало, возвращаем не путь а правило, так как сравнивать будем совпавшие значения
		                           : offs > 0 ? rule : ""; // если rule начинается не с / - то это относительный путь, ищем любое вхождение 
	        case "object":
                    //работаем с регексами
                    var matches = this.match(rule);
		    //console.log("matching: ", matches);
		    switch(true){
		        case matches === null: return "";
		        case matches.length === 1: return matches[0];
			default: //надо найти самое длинное вхождение, но этого не должно происходить - совпадение с началом строки может быть только одно
				//TODO тут вообще то эксепшн надо кидать
				return "impossible match";
		    }
		default:
	    }
	};
	var maxLength = function(arr){
            var res = 0;
	    var i,l;
	    for(i=0, l=arr.length; i<l; i++){
		
                if(res < arr[i].length) res = arr[i].length;
	    }
	    return res;
	};
	var response = {};
	request.bot = request.bot.toLowerCase();
	switch(true){
	    case request.bot === "*":
                //парсим все правила
		//на самом деле при парсинге надо сливать все правила в одну кучу, убирать дубли и оформлять это отдельным блоком
	        break;
	    case request.bot in this.rules.bots:
                //у нас есть такой бот
		response.allow    = "allow"    in this.rules.bots[request.bot] ? this.rules.bots[request.bot].allow.map(match, request.path)    : [];
	        response.disallow = "disallow" in this.rules.bots[request.bot] ? this.rules.bots[request.bot].disallow.map(match, request.path) : [];
		//здесь надо пройтись по совпадениям и решить, какое наиболее значимое
                //а вот здесь болт
		// если длина совпадения одинакова у allow и disallow, то возвращать надо по более конкретному правилу
		//для index.html:
		//allow * disallow .html - возвращаем disallow
		//allow .html disallow * -  возвращаем allow
		//нужна функция, вычисляющая длину нерегулярной части регулярного выражения
		//а также возможно длину нерегулярной части совпадения, то есть то что совпало не по квантификаторам * + {} 
		//болт - во второй версии кто первый совпал - того и тапки. Смотрю, что в первой версии стандарта
		//а в первой allow нет, поэтому вопрос не возникает
		//так, яндекс при одинаковой длине отдает предпочтение allow
		return maxLength(response.allow) >= maxLength(response.disallow);
                break;
	    case "*" in this.rules.bots:
                //смотрим правила для всех прочих
		break;
	    default:
                //нет правил для этого бота
	}
    };
//}}}
//{{{ haveSitemap
Robots.prototype.haveSitemap = function(request){
    return "sitemap" in this.rules && this.rules.sitemap.length;
};
//}}}
//{{{ getSitemap
Robots.prototype.getSitemap = function(request){
    return "sitemap" in this.rules ? this.rules.sitemap : null;
};
//}}}
//{{{ getRate
Robots.prototype.getRate = function(bot){

    var parseRate = function(rate){
        var defRate = 3000;
        var pair = rate.split("/");
	if(pair.length !== 2) return defRate;
	var matches = pair[1].trim().match(/^([0-9]+)([mh]?)$/i);
	if(matches === null) return defRate;
        //вычисляем число секунд, умножаем на 1000 и делим на первое число
	matches[1] = parseInt(matches[1]);
	pair[0] = parseInt(pair[0]);
	if(isNaN(matches[1]) || isNaN(pair[0]) || pair[0] === 0 || matches[1] === 0) return defRate;
	switch(matches[2].toLowerCase()){
            case "h":
                matches[1] = matches[1] * 60 * 60;
	        break;
            case "m":
                matches[1] = matches[1] * 60;
	}
	var res = Math.floor(matches[1]*1000 / pair[0]);
	return res ? res : defRate;
    };
    var parseTime = function(time){
        var def = [0, 86400000];
        var pair = time.split("-");
	if(pair.length !== 2 || pair[0].length !== 4 || pair[1].length !== 4) return def;
	var h1 = parseInt(pair[0].substring(0, 2));
	var m1 = parseInt(pair[0].substring(2, 4));
	var h2 = parseInt(pair[1].substring(0, 2));
	var m2 = parseInt(pair[1].substring(2, 4));
	if(isNaN(h1) || isNaN(h2) || isNaN(m1) || isNaN(m2)) return def;
	var start = (h1*60*60 + m1*60)*1000;
	var end   = (h2*60*60 + m2*60 + 59)*1000;
	//console.log("parseTime: ", time);
	//console.log("ParseTime: ", h1, m1, "::", h2, m2);
	//console.log("parseTime: ", start, end);
        return [start, end];
    };
    var normalize = function(rate){
	var res = [];
	var i, l;
	//console.log("normalize, rate: ", rate);
        //100/24h 10/60 10/10m
	//вообщее то rate - массив. Почему тогда это работает? ЭТО - не работает!!!
	for(i=0, l=rate.length; i<l; i++){
            //определим формат - есть ли интервал
            // /^[0-9]+\/[0-9]+\s[0-9]{4}\-[0-9]{4}$/
            var tmp = rate[i].trim().split(/\s+/);
	    //console.log("normalize: ", tmp, rate);
	    switch(tmp.length){
                case 1:
                    //имеем только rate
                    res.push({"rate": parseRate(tmp[0])}); break;
                case 2:
                    //имеем rate и interval
                    res.push({"rate": parseRate(tmp[0]), "interval": parseTime(tmp[1])});
                default:
		    //ошибка, возвращаем ноль
	    }

	}
	//TODO значения по умолчанию надо брать из config
        return res.length ? res : [{"rate": 3000, "interval" : [0, 86400000]}]; 
    };
    var rules;
    var delay;
    switch(true){
        case (bot in this.rules.bots) && ("crawl-delay" in this.rules.bots[bot]):
            //смотрим rate для этого бота
            delay = parseInt(this.rules.bots[bot]["crawl-delay"]);
            return isNaN(delay) ? 0 : [{"rate": Math.floor(delay * 1000)}];
        case (bot in this.rules.bots) && ("request-rate" in this.rules.bots[bot]):
            rules = this.rules.bots[bot];
            break;
        case ("*" in this.rules.bots) && ("crawl-delay" in this.rules.bots["*"]):
            //смотрим общую секцию
		//console.log(this.rules.bots["*"]["crawl-delay"]);
                delay = parseFloat(this.rules.bots["*"]["crawl-delay"]);
                return isNaN(delay) ? 0 : [{"rate": Math.floor(delay * 1000)}];
        case ("*" in this.rules.bots) && ("request-rate" in this.rules.bots["*"]):
                rules = this.rules.bots["*"];
                break;
	    //вдруг?
	case "crawl-delay" in this.rules.common:
            delay = parseInt(this.rules.bots["*"]["crawl-delay"]);
            return isNaN(delay) ? 0 : [{"rate": Math.floor(delay * 1000)}];
        case "request-rate" in this.rules.common:
            rules = this.rules.common;
            break;
	default:
	    return 0;
    }
    //раз дошли до сюда - в rules имеем visit-rate
    //visit-rate - массив!!!
    return normalize(rules["request-rate"]);
};
//}}}
//{{{ getTime
Robots.prototype.getTime = function(bot){
	//TODO - такой же как и в getRate - возможно имеет смысл сделать его публичным
    var parseTime = function(time){
        var pair = time.split("-");
	var def = [0, 86400000];
	if(pair.length !== 2 || pair[0].length !== 4 || pair[1].length !== 4) return def;
	var h1 = parseInt(pair[0].substring(0, 2));
	var m1 = parseInt(pair[0].substring(2, 4));
	var h2 = parseInt(pair[1].substring(0, 2));
	var m2 = parseInt(pair[0].substring(2, 4));
	if(isNaN(h1) || isNaN(h2) || isNaN(m1) || isNaN(m2)) return def;
	return [(h1*60*60+m1*60)*1000, (h2*60*60+m2*60)*1000]; 
    };
    var normalize = function(times){
//	console.log("Normalise: ", times);
	var res = [];
	var i, l;
	for(i=0, l=times.length; i<l; i++){
            res.push(parseTime(times[i]));
	}
	return res.length ? res : [[0, 86400000]];
    };
    var rules;
    switch(true){
        case (bot in this.rules.bots) && ("visit-time" in this.rules.bots[bot]):
            //смотрим time для этого бота
            rules = this.rules.bots[bot]; break;
        case ("*" in this.rules.bots) && ("visit-time" in this.rules.bots["*"]):
            //смотрим общую секцию
            rules = this.rules.bots["*"]; break;
	    //вдруг?
        case "visit-time" in this.rules.common:
            rules = this.rules.common;
            break;
	default:
	    return 0;
    }
    //console.log(this.rules.bots["spiderbot"]);
    //console.log(this.rules.bots["*"]);
    //console.log(this.rules.common);
    //console.log(rules);
    //раз дошли до сюда - в rules имеем visit-time
    //visit-time - массив!!!
    return normalize(rules["visit-time"]);
};
//}}}
//{{{ getShedule
Robots.prototype.getShedule = function(bot){
    //на выходе - массив элементов {"rate": , "interval": ""}
    var rate = this.getRate(bot);
    var times = this.getTime(bot);
    console.log("rate: ", rate);
    console.log("times: ", times);
    if(rate === 0) rate = [{"rate": 3000}];
    if(times === 0) times = [[0, 86400000]];
    var max = 0;
    var min = 0;
    var interval;
    var res = [];
    var rest = [];
    for(i=0, l=rate.length; i<l; i++) ("interval" in rate[i] ? res : rest).push(rate[i]);
    if(rest.length){
	//берем наибольший rate(наименьшее значение) и назначаем ему наибольший interval
	for(i=0, l=rest.length; i<l; i++) min = !min ? rest[i].rate : (min < rest[i].rate ? min : rest[i].rate);
        for(i=0, l=times.length; i<l; i++) if(times[i][1] - times[i][0] > max) interval = times[i];
        if(!interval) interval = [0, 86400000];
        res.push({"rate": min, "interval": interval});
    }
    return res;
};
//}}}

module.export = Robots;

//var fs = require("fs");
//var content = fs.readFileSync("./robots.txt", "utf8");
//var robots = exports.parser(content);
//и хочу такой синтаксис:
//robots.allow({bot: "*", path: "some path");
//console.log(robots.isAllowed({bot: "chives", path: "/order.shtml"}));
//console.log(robots.isAllowed({bot: "chives", path: "/order.php"}));
//console.log(robots.isAllowed({bot: "pandabot", path: "/images/someimage"}));
//console.log(robots.isAllowed({bot: "pandabot", path: "/images/thisallowed.img?someparamhere=somevalue"}));
//console.log(robots.isAllowed({bot: "suckemdry", path: "/bla/bla/bla.html"}));
//console.log(robots.isAllowed({bot: "suckemdry", path: "/bla/bla/bla.nothtml"}));
//console.log(robots.isAllowed({bot: "suckemdry", path: "/bla/bla/bla.not.html"}));

//console.log(robots.getShedule("spiderbot"));
//console.log(robots.getShedule("pandabot"));
//console.log(robots.getShedule("suckemdry"));
