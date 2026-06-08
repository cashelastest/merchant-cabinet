export interface Deal {
  id: number
  uid: number
  secret: string
  to_values: {
    outAmount?: number
    cardHolder?: string
    cardNumber?: string
    phoneNumber?: string
    bankName?: string
    [key: string]: unknown
  }
  from_xml: string
  from_name: string
  from_image_url: string
  to_xml: string
  to_name: string
  to_image_xml: string
  status: string
  accepted_by: number | null
  created_at: string
  received_at: string | null
}

export interface WsDealMessage {
  event: string
  deal_id: number
  from_xml: string
  data: Omit<Deal, 'id' | 'accepted_by' | 'received_at'>
}
