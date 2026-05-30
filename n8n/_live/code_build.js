// Build Messages — Extract Keyword-ийн replyText + Search by Keyword-ийн products
// ашиглаж текст + carousel карт угсарна.
const NL = String.fromCharCode(10);
const TUG = String.fromCharCode(0x20AE);
const ex = $('Extract Keyword').first().json;
const psid = ex.psid;
let replyText = (ex.replyText || '').trim();
// Search by Keyword node-ийн үр дүн (doSearch=false үед ч ажилласан байж болно)
let search = {};
try { search = $('Search by Keyword').first().json || {}; } catch (e) { search = {}; }
const products = (ex.doSearch && Array.isArray(search.products)) ? search.products : [];
const showProducts = products.length > 0;
if (replyText.length > 1900) replyText = replyText.slice(0,1897)+'...';
if (!showProducts) {
  return [{ json: { psid, replyText, hasCards:false, elements:[] } }];
}
const clip=function(s,m){ s=String(s||'').split(NL).join(' ').trim(); while(s.indexOf('  ')!==-1) s=s.split('  ').join(' '); return s.length>m?s.slice(0,m-1).trim()+'…':s; };
const fmt=function(n0){ var n=Math.round(Number(n0)||0),str=String(n),out='',c=0; for(var i=str.length-1;i>=0;i--){out=str[i]+out;c++;if(c%3===0&&i>0)out=','+out;} return out+TUG; };
const elements = products.slice(0,10).map(function(p){
  var priceLine=(p.salePrice!=null)?('💰 '+fmt(p.salePrice)+'  ·  хуучин '+fmt(p.price)):('💰 '+fmt(p.price));
  var room=79-priceLine.length; var desc=room>12?clip(p.description,room):'';
  var subtitle=desc?clip(priceLine+NL+desc,80):clip(priceLine,80);
  var el={ title:clip(p.title,80), subtitle:subtitle, default_action:{type:'web_url',url:p.url,webview_height_ratio:'full'}, buttons:[{type:'web_url',url:p.url,title:'Дэлгэрэнгүй үзэх'}] };
  if(p.imageUrl) el.image_url=p.imageUrl;
  return el;
});
return [{ json: { psid, replyText, hasCards:elements.length>0, elements } }];
