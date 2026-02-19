import axios from 'axios';
import { API_BASE_URL } from 'constants/featureFlags';
import { auth } from 'lib/firebase';
import { ICategoryProps, INoteTransactionProps, ITransactionProps } from 'types/redux-types';

export type VoiceAnalysis = {
  type?: 'income' | 'expense';
  amount?: number;
  currency?: string | null;
  description?: string | null;
  category?: string | null;
  raw?: string | null;
};

const requireToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.getIdToken();
};

export const analyzeVoiceText = async (params: {
  text: string;
  typeHint?: 'income' | 'expense';
  categories?: string[];
  locale?: string;
  currency?: string;
}): Promise<VoiceAnalysis> => {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL not configured');
  }
  const token = await requireToken();
  const { data } = await axios.post<VoiceAnalysis>(
    `${API_BASE_URL}/voice/parse`,
    {
      text: params.text,
      type_hint: params.typeHint,
      categories: params.categories,
      locale: params.locale,
      currency: params.currency,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return data;
};

export const commitVoiceTransaction = async (params: {
  walletId: string;
  category: ICategoryProps;
  balance: number;
  type: 'income' | 'expensese';
  currency?: string;
  note?: INoteTransactionProps;
  date?: string;
}): Promise<ITransactionProps> => {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL not configured');
  }
  const token = await requireToken();
  const payload = {
    wallet_id: params.walletId,
    category: params.category,
    category_id: params.category?.id ?? null,
    balance: params.balance,
    type: params.type,
    currency: params.currency,
    note: params.note ?? null,
    date: params.date ?? null,
  };
  const { data } = await axios.post<ITransactionProps>(
    `${API_BASE_URL}/voice/commit`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return data;
};
