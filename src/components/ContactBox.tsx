/**
 * 본문 하단 문의 박스(큐 Q32, Figma [v2] 205:102 PC / 207:94 Mobile). 모든 고객 화면 공통.
 * 1:1 채팅(Q37)이 생기기 전까지 채팅 버튼은 1:1 문의 폼으로 보낸다.
 */
export function ContactBox({ phone, chatHref, labels }: { phone: string; chatHref: string; labels: { title: string; hours: string; chat: string } }) {
  return (
    <section className="contact-box" aria-labelledby="contact-box-title">
      <div className="contact-box-text">
        <h2 id="contact-box-title">{labels.title}</h2>
        <p>{labels.hours}</p>
      </div>
      <div className="contact-box-actions">
        <a className="btn btn-lg btn-outline" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
          <img className="btn-icon" src="/ui/contact-phone.svg" alt="" width={20} height={20} />
          {phone}
        </a>
        <a className="btn btn-lg btn-primary" href={chatHref}>
          <img className="btn-icon" src="/ui/chat.svg" alt="" width={20} height={20} />
          {labels.chat}
        </a>
      </div>
    </section>
  )
}
