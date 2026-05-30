# Hybrid AI Keyword Extraction — хэрэгжүүлэх төлөвлөгөө

## Зорилго
Хэрэглэгчийн өгүүлбэрийг AI хүн шиг ойлгож, гол хайх ОБЪЕКТ-г ялгаж, зөвхөн
цэвэр keyword-оор backend search дуудах. Шум үг (чиглэл/төсөл/байна уу) хасагдана.

## Жишээ
- "манханы чиглэлийн төсөл байна уу" → keyword = "манхан" → search("манхан")
- "сүүний фермийн төсөл" → keyword = "сүүний ферм"
- "гахай тахиа байгаа юу" → keyword = "гахай тахиа"
- "төлбөрөө яаж хийх вэ" → keyword алга → search хийхгүй, шууд текст хариу

## Архитектур (шинэ)
```
FB Message → Parse → Get User Profile → AI Agent → Build Messages → Send Text → Has Cards? → Send Cards
```
- "Search DigitalGer" pre-search node ХАСАГДАНА (AI өмнө хайхгүй)
- "Prep Context" хялбаршина (products/showProducts логик хасна)
- Build Messages нь AI хариунаас [SEARCH:xxx] салгаж backend-ийг ЦЭВЭР keyword-оор дуудна

## 3 node өөрчлөлт
1. AI Agent system message — [SEARCH:keyword] гаргах зааварчилгаа нэмнэ
2. Prep Context — products хасч хялбаршуулна
3. Build Messages — [SEARCH:xxx] уншиж backend дахин дуудаж carousel хийнэ

## Backend — ӨӨРЧЛӨХГҮЙ (search() хэвээр)

## Deploy
- backup: _live/current_workflow.json (хадгалагдсан)
- n8n CLI import → update --active=true → docker restart digitalger-n8n
- тест: цэвэр PSID
