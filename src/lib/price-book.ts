import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { minor, type Currency, type PriceBook } from '@ayuta/pricing'

/**
 * DB 의 단가를 계산기가 먹을 모양으로 바꾼다.
 * 계산기는 DB 를 모르고 이 함수는 계산을 모른다 — 그래서 계산기를 DB 없이 테스트할 수 있다.
 */
const LIMIT = 1000

export async function loadPriceBook(category: number, currency: Currency): Promise<PriceBook> {
  const payload = await getPayload({ config })
  const { docs, totalDocs } = await payload.find({
    collection: 'price-entries',
    where: { and: [{ category: { equals: category } }, { active: { equals: true } }] },
    limit: LIMIT,
    overrideAccess: true,
  })
  // limit을 넘겨 잘린 채로 조용히 견적을 내면 빠진 항목만큼 조용히 틀린 가격이 나간다.
  // 잘못된 견적을 주느니 여기서 멈추는 게 낫다.
  if (totalDocs > LIMIT) throw new Error(`카테고리 ${category}의 단가 항목이 ${LIMIT}건을 초과했습니다: ${totalDocs}건`)

  const entries: PriceBook['entries'] = {}
  for (const d of docs) {
    const raw = currency === 'KRW' ? d.priceKrw : d.priceJpy
    // 통화에 맞는 언어의 라벨을 고른다 — KRW 결제는 한국어 계약서, JPY 는 일본어 계약서로
    // 이어지므로 여기서 언어를 고정해야 나중에 문구가 바뀌어도 과거 주문 스냅샷이 안 흔들린다.
    const label = currency === 'KRW' ? d.labelKo : d.labelJa
    // minor() 가 정수·음수를 런타임에 거부한다. DB 가 오염돼도 여기서 멈춘다
    entries[d.key as string] = { key: d.key as string, label: label as string, amount: minor(raw as number) }
  }
  return { currency, entries }
}
