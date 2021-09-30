const { lstatSync, readFileSync, writeFileSync } = require('fs');
const { extname } = require('path');

function isDir(path) {
  const stat = lstatSync(path);
  return stat.isDirectory();
}

function lexicalAnalysis(content) {
  const tokenList = [];
  let currentStr = '';
  let currentType = '';
  const handleChar = (char, type) => {
    if (currentType == type) {
      currentStr += char;
    } else {
      tokenList.push({
        type: currentType,
        content: currentStr
      })
      currentStr = char;
      currentType = type;
    }
  }
  for (const char of content) {
    if (char == ' ') {
      handleChar(char, 'SPACE');
    } else if (char == '\n') {
      handleChar(char, 'ENTER');
    } else if (char.match(/[\x21-\x2f\x3a-\x40\x5b-\x60\x7B-\x7F]/) || char.charCodeAt() === 8212) {
      //半角 和破折号 ——
      handleChar(char, 'HALF');
    } else if (char.charCodeAt() === 12290 || (char.charCodeAt() > 65280 && char.charCodeAt() < 65375)) {
      //全角 (处理一下。) TODO: 为什么句号的charcode这么奇怪
      handleChar(char, 'FULL');
    } else if (char.match(/[\u4e00-\u9fa5]/)) {
      //中文
      handleChar(char, 'CHINESE')
    } else if (char.match(/[0-9]/)) {
      handleChar(char, 'NUMBER');
    } else {
      handleChar(char, 'ENGLISH');
    }
  }
  tokenList.push({
    type: currentType,
    content: currentStr
  })
  return tokenList;
}

const handleTokenList = (tokenList) => {
  let resList = [];
  const length = tokenList.length;
  const SPACE_TOKEN = {
    type: 'SPACE',
    content: ' '
  }
  // 暂时支持：
  // - 。.  
  // - ？? 
  // - , ，
  // - ！!  
  // - ；;  
  // - ：:  
  const punctuationMap = new Map([
    ['。', '.'],
    ['，', ','],
    ['？', '?'],
    ['！', '!'],
    ['；', ';'],
    ['：', ':'],
    ['.', '。'],
    [',', '，'],
    ['?', '？'],
    ['!', '！'],
    [';', '；'],
    [':', '：'],
  ])
  for(let i = 0; i < length; i++) {
    resList.push(tokenList[i]);
    // 要求六：中文接的是全角字符
    if(['.', '?', '!', ';', ':'].includes(tokenList[i].content)) {
      if(resList[resList.length - 2] && resList[resList.length - 2].type == 'CHINESE') {
        resList.pop();
        resList.push({
          type: 'FULL',
          content: punctuationMap.get(tokenList[i].content)
        });
      }
    }

    // 要求七：英文接的是半角字符
    if(['。', '？', '！', '；', '：'].includes(tokenList[i].content)) {
      if(resList[resList.length - 2] && resList[resList.length - 2].type == 'ENGLISH') {
        resList.pop();
        resList.push({
          type: 'HALF',
          content: punctuationMap.get(tokenList[i].content)
        });
      }
    }

    // 要求四：不重复使用标点符号
    if(tokenList[i].type === 'FULL') {
      resList.pop();
      let end = '';
      let str = '';
      for(const char of tokenList[i].content) {
        if(end == char && ["？", "！", "【", "】"].includes(char)){
          continue;
        } else {
          str += char;
        }
      }
      resList.push({
        type: 'FULL',
        content: str
      });
    }

    if(tokenList[i].content.match(/^[。]{2,}$/)) {
    }

    // 要求五：省略号
    if(resList[resList.length - 2] && ['CHINESE', 'ENGLISH'].includes(resList[resList.length - 2].type) && tokenList[i].content.match(/^[。]{2,}$/)){
      resList.pop();
      resList.push({
        type: 'HALF',
        content: '……'
      })
    }

    // 要求一：中英文之间需要增加空格 中文与数字之间要有空格
    // 前
    if(tokenList[i].type == 'CHINESE') {
      if(tokenList[i+1] && ['ENGLISH', 'NUMBER'].includes(tokenList[i+1].type)) {
        resList.push(SPACE_TOKEN);
      }
      if(tokenList[i+2] && ['`', '**', '*'].includes(tokenList[i+1].content) && ['ENGLISH', 'NUMBER'].includes(tokenList[i+2].type)){
        resList.push(SPACE_TOKEN);
      }
    }
    // 后
    if(['ENGLISH', 'NUMBER'].includes(tokenList[i].type)) {
      if(tokenList[i+1] && tokenList[i+1].type === 'CHINESE') {
        resList.push(SPACE_TOKEN);
      }
    }
    if(['`', '**', '*'].includes(tokenList[i].content)) {
      if(resList[resList.length - 2]&&resList[resList.length - 2].type === 'ENGLISH' && tokenList[i+1] && tokenList[i+1].type === 'CHINESE') {
        resList.push(SPACE_TOKEN);
      }
    }

    // 要求二：数字与单位之间需要增加空格
    if(tokenList[i].type === 'NUMBER' && tokenList[i+1] && tokenList[i+1].type === 'ENGLISH') {
      resList.push(SPACE_TOKEN);
    }

    // 要求三：全角标点与其他字符之间不加空格 
    if(resList[resList.length - 1].type == 'SPACE'&&tokenList[i+1]&&tokenList[i+1].type === 'FULL') {
      resList.pop();
    }
    // -- 避免不一致的情况
    if(resList[resList.length - 1]== 'SPACE'&&resList[resList.length - 2]&&resList[resList.length - 2].type === 'FULL') {
      resList.pop();
    }

    //要求五：破折号前后需要增加一个空格
    if(tokenList[i].content == '——') {
      if(resList[resList.length - 2]&&resList[resList.length - 2].type != 'SPACE') {
        const current = resList.pop();
        resList.push(SPACE_TOKEN);
        resList.push(current);
      } 
      if(tokenList[i+1] && tokenList[i+1].type != 'SPACE') {
        resList.push(SPACE_TOKEN);
      }
    }
  }
  return resList;
}

const isMarkdown = (path) => {
  if (isDir(path)) {
    return false;
  }
  if (extname(path) != '.md') {
    return false;
  }
  return true;
}

const formatMarkdown = (path) => {
  const fileOptions = { encoding: 'utf-8' };
  const content = readFileSync(path, fileOptions);
  const tokenList = lexicalAnalysis(content);
  const handledTokenList = handleTokenList(tokenList);
  writeFileSync(path, handledTokenList.map(item => item.content).join(''), fileOptions);
  return true;
}

module.exports = {
  isMarkdown,
  formatMarkdown
}