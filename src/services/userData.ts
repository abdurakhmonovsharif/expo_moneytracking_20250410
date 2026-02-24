import { ImageSourcePropType } from 'react-native';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from 'lib/firebase';
import { updateProfile } from 'firebase/auth';
import { IMAGE_ICON_CATEGORY } from 'assets/IconCategory';
import { Images } from 'assets/images';
import {
  BudgetEnumType,
  CurrencyEnumType,
  IBudgetProps,
  INoteTransactionProps,
  IPlanBudgetProps,
  ITransactionProps,
  IWalletProps,
  IUserProfile,
} from 'types/redux-types';
import {
  creatBudget,
  resetAppState,
  setCurrency,
  setLanguage,
  setUserProfile,
  setWallets,
  setPermissions,
} from 'reduxs/reducers/app-reducer';
import { AppDispatch } from 'reduxs/store';
import { runWithAppRequest } from 'reduxs/requestLoading';
import { DEFAULT_LANGUAGE, LanguageCode } from 'i18n/translations';
import { fetchUserPermissions } from 'services/permissionsService';

type UserDoc = {
  name?: string;
  currency?: CurrencyEnumType;
  baseCurrency?: CurrencyEnumType;
  language?: LanguageCode;
  email?: string | null;
  photo_url?: string | null;
  created_at?: string;
  plan?: string;
  is_premium?: boolean;
  premium_until?: string | null;
  premium_status?: string | null;
  premium_since?: string | null;
  premium_source?: string | null;
};

type WalletDoc = {
  id: string;
  symbol: string;
  title: string;
  balance: number;
  currency?: CurrencyEnumType;
  image?: string | null;
};

type NoteDoc = {
  textNote?: string;
  imageKey?: string;
  imageUri?: string | null;
};

type TransactionDoc = {
  id: string;
  userId: string;
  walletId: string;
  categoryId: string | number;
  balance: number;
  date: string;
  type: string;
  currency?: CurrencyEnumType;
  note?: NoteDoc | null;
  category: any;
};

type BudgetDoc = {
  id: string | number;
  parentId: string | number;
  imageKey?: string;
  title: string;
  amount: number;
  balance: number;
  create_at: string;
};

type PlanBudgetDoc = {
  id: string | number;
  type: BudgetEnumType;
  transactions: TransactionDoc[];
  budgets: BudgetDoc[];
  create_at: string;
};

type BillDoc = {
  title: string;
  balance: number;
  date: string;
  time_type: string;
  imageKey?: string;
  created_at: string;
};

const INITIAL_SYNC_TIMEOUT_MS = 12000;

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const requireUser = () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
};

const FALLBACK_BASE_CURRENCY: CurrencyEnumType = 'UZS';

const toIsoString = (value?: string | Date | { toDate?: () => Date } | null) => {
  if (!value) {
    return new Date().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value.toDate) {
    return value.toDate().toISOString();
  }
  return new Date(value as any).toISOString();
};

const parseDate = (value?: string | Date | { toDate?: () => Date } | null) => {
  if (!value) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    return new Date(value);
  }
  if (typeof value === 'object' && value.toDate) {
    return value.toDate();
  }
  return new Date(value as any);
};

const findKeyByValue = (
  map: Record<string, ImageSourcePropType>,
  value?: ImageSourcePropType | null
) => {
  if (!value) return undefined;
  const entry = Object.entries(map).find(([, v]) => v === value);
  return entry?.[0];
};

const imageFromKey = (
  map: Record<string, ImageSourcePropType>,
  key?: string
) => {
  if (!key) return undefined;
  return map[key];
};

const serializeNote = (note?: INoteTransactionProps): NoteDoc | null => {
  if (!note) return null;
  const imageKey =
    note.imageKey ||
    findKeyByValue(Images as Record<string, ImageSourcePropType>, note.images);
  const imageUri =
    note.images &&
    typeof note.images === 'object' &&
    !Array.isArray(note.images) &&
    'uri' in note.images &&
    typeof note.images.uri === 'string'
      ? note.images.uri
      : null;
  const textNote =
    typeof note.textNote === 'string' && note.textNote.trim().length > 0
      ? note.textNote.trim()
      : undefined;
  const serialized: NoteDoc = {};
  if (textNote !== undefined) {
    serialized.textNote = textNote;
  }
  if (imageKey !== undefined) {
    serialized.imageKey = imageKey;
  }
  if (imageUri !== null) {
    serialized.imageUri = imageUri;
  }
  if (
    serialized.textNote === undefined &&
    serialized.imageKey === undefined &&
    serialized.imageUri === undefined
  ) {
    return null;
  }
  return serialized;
};

const deserializeNote = (note?: NoteDoc | null): INoteTransactionProps | undefined => {
  if (!note) return undefined;
  const mappedImage = imageFromKey(
    Images as Record<string, ImageSourcePropType>,
    note.imageKey
  );
  const uriImage = note.imageUri ? ({ uri: note.imageUri } as ImageSourcePropType) : undefined;
  return {
    textNote: note.textNote,
    imageKey: note.imageKey,
    images: mappedImage ?? uriImage,
  };
};

const serializeTransaction = (
  tx: ITransactionProps,
  userId: string,
  walletId: string
): TransactionDoc => {
  const doc: TransactionDoc = {
    id: String(tx.id),
    userId: userId,
    walletId: walletId,
    categoryId: tx.categoryId ?? tx.category?.id ?? '',
    balance: tx.balance,
    date: toIsoString(tx.date),
    type: tx.type,
    note: serializeNote(tx.note),
    category: tx.category,
  };
  if (tx.currency) {
    doc.currency = tx.currency;
  }
  return doc;
};

const deserializeTransaction = (
  data: TransactionDoc,
  id: string,
  userId: string,
  walletId: string,
  fallbackCurrency?: CurrencyEnumType
): ITransactionProps => {
  return {
    id: data.id ?? id,
    userId: data.userId ?? userId,
    walletId: data.walletId ?? walletId,
    categoryId: data.categoryId ?? data.category?.id ?? '',
    balance: Number(data.balance ?? 0),
    date: parseDate(data.date),
    type: data.type as any,
    currency: data.currency ?? fallbackCurrency,
    note: deserializeNote(data.note ?? null),
    category: data.category,
  };
};

const serializeBudget = (budget: IBudgetProps): BudgetDoc => {
  const imageKey =
    budget.imageKey ||
    findKeyByValue(
      IMAGE_ICON_CATEGORY as Record<string, ImageSourcePropType>,
      budget.image
    );
  return {
    id: budget.id,
    parentId: budget.parentId,
    imageKey,
    title: budget.title,
    amount: budget.amount,
    balance: budget.balance,
    create_at: toIsoString(budget.create_at),
  };
};

const deserializeBudget = (data: BudgetDoc): IBudgetProps => {
  return {
    id: data.id,
    parentId: data.parentId,
    imageKey: data.imageKey,
    image:
      imageFromKey(
        IMAGE_ICON_CATEGORY as Record<string, ImageSourcePropType>,
        data.imageKey
      ) || IMAGE_ICON_CATEGORY.ic001,
    title: data.title,
    amount: Number(data.amount ?? 0),
    balance: Number(data.balance ?? 0),
    create_at: parseDate(data.create_at),
  };
};

const serializePlanBudget = (plan: IPlanBudgetProps): PlanBudgetDoc => {
  return {
    id: plan.id,
    type: plan.type,
    transactions: plan.transactions.map((tx) =>
      serializeTransaction(
        tx,
        String(tx.userId ?? ''),
        String(tx.walletId ?? '')
      )
    ),
    budgets: plan.budgets.map(serializeBudget),
    create_at: toIsoString(plan.create_at),
  };
};

const deserializePlanBudget = (
  data: PlanBudgetDoc,
  id: string,
  fallbackCurrency?: CurrencyEnumType
): IPlanBudgetProps => {
  return {
    id: data.id ?? id,
    type: data.type ?? BudgetEnumType.MONTHLY,
    transactions: (data.transactions ?? []).map((tx) =>
      deserializeTransaction(
        tx,
        tx.id,
        String(tx.userId ?? ''),
        String(tx.walletId ?? ''),
        fallbackCurrency
      )
    ),
    budgets: (data.budgets ?? []).map(deserializeBudget),
    create_at: parseDate(data.create_at),
  };
};

const deriveName = (email?: string | null, displayName?: string | null) => {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }
  if (email) {
    const prefix = email.split('@')[0];
    if (prefix) {
      return prefix.replace(/[._-]+/g, ' ').trim();
    }
  }
  return 'User';
};

const ensureUserDoc = async (): Promise<
  IUserProfile & {
    currency: CurrencyEnumType;
    baseCurrency: CurrencyEnumType;
    language: LanguageCode;
  }
> => {
  const user = requireUser();
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  const fallbackName = deriveName(user.email, user.displayName);
  if (!snapshot.exists()) {
    const payload: UserDoc = {
      name: fallbackName,
      email: user.email ?? null,
      photo_url: user.photoURL ?? null,
      currency: CurrencyEnumType.USD,
      baseCurrency: FALLBACK_BASE_CURRENCY,
      language: DEFAULT_LANGUAGE,
      created_at: new Date().toISOString(),
      plan: 'free',
      is_premium: false,
    };
    await setDoc(userRef, payload);
    return {
      uid: user.uid,
      name: payload.name ?? fallbackName,
      email: payload.email,
      photo_url: payload.photo_url ?? null,
      currency: payload.currency ?? CurrencyEnumType.USD,
      baseCurrency: payload.baseCurrency ?? FALLBACK_BASE_CURRENCY,
      language: payload.language ?? DEFAULT_LANGUAGE,
      plan: payload.plan,
      is_premium: payload.is_premium,
      premium_until: payload.premium_until ?? null,
      premium_status: payload.premium_status ?? null,
      premium_since: payload.premium_since ?? null,
      premium_source: payload.premium_source ?? null,
    };
  }
  const data = snapshot.data() as UserDoc;
  const updates: UserDoc = {};
  if (!data.email && user.email) {
    updates.email = user.email;
  }
  if (!data.photo_url && user.photoURL) {
    updates.photo_url = user.photoURL;
  }
  if (!data.name) {
    updates.name = fallbackName;
  }
  if (!data.currency) {
    updates.currency = CurrencyEnumType.USD;
  }
  if (!data.baseCurrency) {
    updates.baseCurrency = FALLBACK_BASE_CURRENCY;
  }
  if (!data.language) {
    updates.language = DEFAULT_LANGUAGE;
  }
  if (!data.plan) {
    updates.plan = 'free';
  }
  if (data.is_premium === undefined) {
    updates.is_premium = data.plan === 'premium';
  }
  if (Object.keys(updates).length > 0) {
    await setDoc(userRef, updates, { merge: true });
  }
  return {
    uid: user.uid,
    name: data.name ?? updates.name ?? fallbackName,
    email: data.email ?? updates.email ?? user.email ?? null,
    photo_url: data.photo_url ?? updates.photo_url ?? user.photoURL ?? null,
    currency: data.currency ?? updates.currency ?? CurrencyEnumType.USD,
    baseCurrency: data.baseCurrency ?? updates.baseCurrency ?? FALLBACK_BASE_CURRENCY,
    language: data.language ?? updates.language ?? DEFAULT_LANGUAGE,
    plan: data.plan ?? updates.plan ?? 'free',
    is_premium: data.is_premium ?? updates.is_premium ?? false,
    premium_until: data.premium_until ?? null,
    premium_status: data.premium_status ?? null,
    premium_since: data.premium_since ?? null,
    premium_source: data.premium_source ?? null,
  };
};

export const loadUserData = async (): Promise<{
  profile: IUserProfile;
  currency: CurrencyEnumType;
  language: LanguageCode;
  wallets: IWalletProps[];
  budget?: IPlanBudgetProps;
}> => {
  const user = requireUser();
  const profileWithCurrency = await ensureUserDoc();
  const { currency, language, baseCurrency, ...profile } = profileWithCurrency;
  const userCurrency = currency ?? CurrencyEnumType.USD;
  const fallbackBaseCurrency = baseCurrency ?? FALLBACK_BASE_CURRENCY;
  const walletsRef = collection(db, 'users', user.uid, 'wallets');
  const walletSnap = await getDocs(walletsRef);
  const wallets: IWalletProps[] = [];

  for (const walletDoc of walletSnap.docs) {
    const walletData = walletDoc.data() as WalletDoc;
    const txSnap = await getDocs(collection(walletDoc.ref, 'transactions'));
    const walletCurrency = walletData.currency ?? fallbackBaseCurrency;
    if (!walletData.currency) {
      await updateDoc(walletDoc.ref, { currency: walletCurrency });
    }
    const transactions = txSnap.docs.map((txDoc) =>
      deserializeTransaction(
        txDoc.data() as TransactionDoc,
        txDoc.id,
        user.uid,
        walletDoc.id,
        walletCurrency
      )
    );
    wallets.push({
      id: walletDoc.id,
      symbol: walletData.symbol ?? '',
      title: walletData.title ?? '',
      balance: Number(walletData.balance ?? 0),
      currency: walletCurrency,
      image: walletData.image ?? null,
      transaction: transactions,
    });
  }

  const planSnap = await getDocs(collection(db, 'users', user.uid, 'planBudgets'));
  let budget: IPlanBudgetProps | undefined;
  if (!planSnap.empty) {
    const docs = planSnap.docs.map((docItem) => ({
      id: docItem.id,
      data: docItem.data() as PlanBudgetDoc,
    }));
    docs.sort((a, b) => {
      const aDate = parseDate(a.data.create_at).getTime();
      const bDate = parseDate(b.data.create_at).getTime();
      return aDate - bDate;
    });
    const latest = docs[docs.length - 1];
    budget = deserializePlanBudget(latest.data, latest.id, fallbackBaseCurrency);
  }

  return { profile, currency: userCurrency, language, wallets, budget };
};

export const syncUserData = async (dispatch: AppDispatch) => {
  dispatch(resetAppState());
  await runWithAppRequest(async () => {
    const data = await withTimeout(
      loadUserData(),
      INITIAL_SYNC_TIMEOUT_MS,
      "Initial user data sync timed out"
    );
    dispatch(setWallets(data.wallets));
    dispatch(setUserProfile(data.profile));
    dispatch(setCurrency(data.currency));
    dispatch(setLanguage(data.language));
    if (data.budget) {
      dispatch(creatBudget(data.budget));
    }
  });

  // Permissions are non-critical for initial paint; fetch in background.
  fetchUserPermissions()
    .then((permissions) => {
      if (permissions) {
        dispatch(setPermissions(permissions));
      }
    })
    .catch(() => {
      // keep app responsive even when API is unavailable
    });
};

export const createWalletForUser = async (payload: {
  title: string;
  symbol: string;
  balance: number;
  currency?: CurrencyEnumType;
  image?: string | null;
}): Promise<IWalletProps> => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const walletsRef = collection(db, 'users', user.uid, 'wallets');
    const walletRef = doc(walletsRef);
    const walletDoc: WalletDoc = {
      id: walletRef.id,
      symbol: payload.symbol,
      title: payload.title,
      balance: payload.balance,
      image: payload.image ?? null,
    };
    if (payload.currency) {
      walletDoc.currency = payload.currency;
    }
    await setDoc(walletRef, walletDoc);
    return {
      id: walletRef.id,
      symbol: payload.symbol,
      title: payload.title,
      balance: payload.balance,
      currency: payload.currency,
      image: payload.image ?? null,
      transaction: [],
    };
  });
};

export const updateWalletForUser = async (wallet: IWalletProps) => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const walletRef = doc(db, 'users', user.uid, 'wallets', String(wallet.id));
    await updateDoc(walletRef, {
      symbol: wallet.symbol,
      title: wallet.title,
      balance: wallet.balance,
      image: wallet.image ?? null,
      ...(wallet.currency ? { currency: wallet.currency } : {}),
    });
  });
};

export const deleteWalletForUser = async (walletId: number | string) => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const walletRef = doc(db, 'users', user.uid, 'wallets', String(walletId));
    const txSnap = await getDocs(collection(walletRef, 'transactions'));
    const batch = writeBatch(db);
    txSnap.forEach((tx) => batch.delete(tx.ref));
    batch.delete(walletRef);
    await batch.commit();
  });
};

export const addTransactionForUser = async (params: {
  walletId: number | string;
  categoryId: number | string;
  balance: number;
  date: Date | string;
  type: string;
  currency?: CurrencyEnumType;
  note?: INoteTransactionProps;
  category: any;
}): Promise<ITransactionProps> => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const walletId = String(params.walletId);
    const txRef = doc(
      collection(db, 'users', user.uid, 'wallets', walletId, 'transactions')
    );
    const transaction: ITransactionProps = {
      id: txRef.id,
      userId: user.uid,
      walletId: walletId,
      categoryId: params.categoryId,
      balance: params.balance,
      date: params.date,
      type: params.type as any,
      currency: params.currency,
      note: params.note,
      category: params.category,
    };
    const txDoc = serializeTransaction(transaction, user.uid, walletId);
    await setDoc(txRef, txDoc);
    return {
      ...transaction,
      note: deserializeNote(txDoc.note ?? null),
      date: parseDate(txDoc.date),
    };
  });
};

export const savePlanBudgetForUser = async (plan: IPlanBudgetProps) => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const planRef = doc(db, 'users', user.uid, 'planBudgets', String(plan.id));
    const planDoc = serializePlanBudget(plan);

    const batch = writeBatch(db);
    const budgetsRef = collection(db, 'users', user.uid, 'budgets');
    planDoc.budgets.forEach((budget) => {
      const budgetRef = doc(budgetsRef);
      batch.set(budgetRef, budget);
    });
    batch.set(planRef, planDoc, { merge: true });
    await batch.commit();
  });
};

export const setUserCurrency = async (currency: CurrencyEnumType) => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { currency }, { merge: true });
  });
};

export const setUserLanguage = async (language: LanguageCode) => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { language }, { merge: true });
  });
};

export const updateUserProfile = async (payload: {
  name: string;
  photo_url?: string | null;
}): Promise<IUserProfile> => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const nextName = payload.name.trim();
    if (!nextName) {
      throw new Error('Name is required.');
    }
    const nextPhotoUrl =
      payload.photo_url === undefined ? user.photoURL ?? null : payload.photo_url;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        name: nextName,
        photo_url: nextPhotoUrl ?? null,
      },
      { merge: true }
    );
    try {
      await updateProfile(user, {
        displayName: nextName,
        photoURL: nextPhotoUrl ?? null,
      });
    } catch {
      // Auth profile update is best-effort; Firestore remains source of truth.
    }
    return {
      uid: user.uid,
      name: nextName,
      email: user.email ?? null,
      photo_url: nextPhotoUrl ?? null,
    };
  });
};

const deleteCollection = async (ref: ReturnType<typeof collection>) => {
  const snap = await getDocs(ref);
  if (snap.empty) return;
  let batch = writeBatch(db);
  let count = 0;
  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    count += 1;
    if (count >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) {
    await batch.commit();
  }
};

export const clearUserDataForUser = async (): Promise<void> => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const userRef = doc(db, 'users', user.uid);

    const walletsRef = collection(db, 'users', user.uid, 'wallets');
    const walletsSnap = await getDocs(walletsRef);
    for (const walletDoc of walletsSnap.docs) {
      await deleteCollection(collection(walletDoc.ref, 'transactions'));
      await deleteDoc(walletDoc.ref);
    }

    await deleteCollection(collection(db, 'users', user.uid, 'planBudgets'));
    await deleteCollection(collection(db, 'users', user.uid, 'budgets'));
    await deleteCollection(collection(db, 'users', user.uid, 'bills'));

    await deleteDoc(userRef);
  });
};

export const loadRecurringBillsForUser = async (): Promise<(BillDoc & { id: string })[]> => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const billsRef = collection(db, 'users', user.uid, 'bills');
    const snap = await getDocs(billsRef);
    const bills = snap.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as BillDoc),
    }));
    bills.sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
    return bills;
  });
};

export const addRecurringBillForUser = async (payload: {
  title: string;
  balance: number;
  date: Date | string;
  time_type: string;
  imageKey?: string;
}): Promise<BillDoc & { id: string }> => {
  return runWithAppRequest(async () => {
    const user = requireUser();
    const billsRef = collection(db, 'users', user.uid, 'bills');
    const billRef = doc(billsRef);
    const billDoc: BillDoc = {
      title: payload.title,
      balance: payload.balance,
      date: toIsoString(payload.date),
      time_type: payload.time_type,
      imageKey: payload.imageKey,
      created_at: new Date().toISOString(),
    };
    await setDoc(billRef, billDoc);
    return { id: billRef.id, ...billDoc };
  });
};
