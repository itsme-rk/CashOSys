import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

// Helper to get user subcollection reference
function userCollection(userId, collectionName) {
  return collection(db, 'users', userId, collectionName);
}

function userDoc(userId, collectionName, docId) {
  return doc(db, 'users', userId, collectionName, docId);
}

// ===========================
// USER PROFILE
// ===========================
export async function getUserProfile(userId) {
  const docRef = doc(db, 'users', userId);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createUserProfile(userId, data) {
  const docRef = doc(db, 'users', userId);
  const profileData = {
    ...data,
    salaryCycleDay: data.salaryCycleDay || 28,
    currency: 'INR',
    theme: 'dark',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(docRef, profileData).catch(() => {
    const { setDoc } = require('firebase/firestore');
    return setDoc(docRef, profileData);
  });
  return profileData;
}

export async function updateUserProfile(userId, data) {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

// ===========================
// GENERIC CRUD
// ===========================
export async function addDocument(userId, collectionName, data) {
  const colRef = userCollection(userId, collectionName);
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, ...data };
}

export async function updateDocument(userId, collectionName, docId, data) {
  const docRef = userDoc(userId, collectionName, docId);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteDocument(userId, collectionName, docId) {
  const docRef = userDoc(userId, collectionName, docId);
  await deleteDoc(docRef);
}

export async function clearAllUserData(userId) {
  const collections = ['transactions', 'investments', 'emergencyFund', 'personalLending', 'loans', 'goals', 'watchlist'];
  
  for (const collName of collections) {
    const colRef = userCollection(userId, collName);
    const snap = await getDocs(colRef);
    
    // Firestore batches support up to 500 operations
    let batch = writeBatch(db);
    let count = 0;
    
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      count++;
      
      if (count === 490) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }
  }
}


export async function getDocuments(userId, collectionName, constraints = []) {
  const colRef = userCollection(userId, collectionName);
  const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDocument(userId, collectionName, docId) {
  const docRef = userDoc(userId, collectionName, docId);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ===========================
// REAL-TIME LISTENERS
// ===========================
export function subscribeToCollection(userId, collectionName, callback, constraints = []) {
  const colRef = userCollection(userId, collectionName);
  const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef);
  
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(docs);
  }, (error) => {
    console.error(`Error subscribing to ${collectionName}:`, error);
  });
}

// ===========================
// TRANSACTIONS (Income + Expenses)
// ===========================
export async function addTransaction(userId, data) {
  return addDocument(userId, 'transactions', {
    type: data.type, // 'income' or 'expense'
    category: data.category,
    description: data.description || '',
    amount: Number(data.amount),
    date: data.date,
    fundingSource: data.fundingSource || '',
    salaryCycleId: data.salaryCycleId || '',
    salaryCycleLabel: data.salaryCycleLabel || '',
    isInvestment: data.isInvestment || false,
    linkedInvestmentId: data.linkedInvestmentId || null,
  });
}

export function subscribeTransactions(userId, callback) {
  return subscribeToCollection(userId, 'transactions', callback, [
    orderBy('date', 'desc'),
  ]);
}

// ===========================
// INVESTMENTS
// ===========================
export async function addInvestment(userId, data) {
  return addDocument(userId, 'investments', {
    bucket: data.bucket,
    instrumentName: data.instrumentName || '',
    fundingSource: data.fundingSource || '',
    investedAmount: Number(data.investedAmount) || 0,
    currentValue: Number(data.currentValue) || Number(data.investedAmount) || 0,
    quantity: Number(data.quantity) || 0,
    ticker: data.ticker || '',
    purchaseDate: data.purchaseDate || '',
    description: data.description || '',
    withdrawal: Number(data.withdrawal) || 0,
  });
}

export function subscribeInvestments(userId, callback) {
  return subscribeToCollection(userId, 'investments', callback);
}

// ===========================
// EMERGENCY FUND
// ===========================
export async function addEmergencyFundEntry(userId, data) {
  return addDocument(userId, 'emergencyFund', {
    description: data.description || '',
    amount: Number(data.amount),
    date: data.date,
    type: data.type || 'deposit',
  });
}

export function subscribeEmergencyFund(userId, callback) {
  return subscribeToCollection(userId, 'emergencyFund', callback, [
    orderBy('date', 'asc'),
  ]);
}

// ===========================
// GOALS
// ===========================
export async function addGoal(userId, data) {
  return addDocument(userId, 'goals', {
    name: data.name,
    targetAmount: Number(data.targetAmount),
    savedAmount: Number(data.savedAmount) || 0,
    deadline: data.deadline || null,
    priority: data.priority || 'medium',
  });
}

export function subscribeGoals(userId, callback) {
  return subscribeToCollection(userId, 'goals', callback);
}

// ===========================
// LOANS
// ===========================
export async function addLoan(userId, data) {
  return addDocument(userId, 'loans', {
    name: data.name,
    totalAmount: Number(data.totalAmount),
    emi: Number(data.emi) || 0,
    interestRate: Number(data.interestRate) || 0,
    paidTillDate: Number(data.paidTillDate) || 0,
    startDate: data.startDate || '',
    endDate: data.endDate || '',
  });
}

export function subscribeLoans(userId, callback) {
  return subscribeToCollection(userId, 'loans', callback);
}

// ===========================
// PERSONAL LENDING
// ===========================
export async function addLending(userId, data) {
  return addDocument(userId, 'personalLending', {
    personName: data.personName,
    amount: Number(data.amount),
    date: data.date,
    status: data.status || 'waiting',
    expectedReturn: data.expectedReturn || null,
    notes: data.notes || '',
  });
}

export function subscribeLending(userId, callback) {
  return subscribeToCollection(userId, 'personalLending', callback);
}

// ===========================
// WATCHLIST
// ===========================
export async function addWatchlistItem(userId, data) {
  return addDocument(userId, 'watchlist', {
    ticker: data.ticker || '',
    name: data.name,
    type: data.type || 'stock',
    alertPrice: Number(data.alertPrice) || 0,
    targetBuyPrice: Number(data.targetBuyPrice) || 0,
    whyBuy: data.whyBuy || '',
    priority: data.priority || 'medium',
    sector: data.sector || '',
    notes: data.notes || '',
  });
}

export function subscribeWatchlist(userId, callback) {
  return subscribeToCollection(userId, 'watchlist', callback);
}

// ===========================
// CATEGORIES (Custom)
// ===========================
export async function addCategory(userId, data) {
  return addDocument(userId, 'categories', {
    name: data.name,
    type: data.type, // 'expense', 'income', 'investment'
    icon: data.icon || '📌',
    color: data.color || '#ABB2B9',
    isDefault: false,
  });
}

export function subscribeCategories(userId, callback) {
  return subscribeToCollection(userId, 'categories', callback);
}

// ===========================
// INCOME SOURCES
// ===========================
export async function addIncomeSource(userId, data) {
  return addDocument(userId, 'incomeSources', {
    name: data.name,
    type: data.type || 'other',
    color: data.color || '#00E676',
    icon: data.icon || '💰',
    isActive: true,
  });
}

export function subscribeIncomeSources(userId, callback) {
  return subscribeToCollection(userId, 'incomeSources', callback);
}

// ===========================
// BATCH IMPORT (for Excel import)
// ===========================
export async function batchImport(userId, collectionName, records, onProgress) {
  const colRef = userCollection(userId, collectionName);
  // Use smaller chunks for faster individual commits and better progress UX
  const CHUNK_SIZE = 200;
  let imported = 0;
  let errors = 0;
  
  // Use a local timestamp instead of serverTimestamp() to avoid
  // per-document server roundtrip cost during batch writes
  const now = new Date().toISOString();
  
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    
    chunk.forEach(record => {
      const docRef = doc(colRef);
      batch.set(docRef, {
        ...record,
        createdAt: now,
        updatedAt: now,
        importedAt: now,
      });
    });
    
    try {
      await batch.commit();
      imported += chunk.length;
    } catch (err) {
      console.error(`Batch import error (${collectionName}, chunk ${i}):`, err);
      errors += chunk.length;
    }
    
    // Report progress
    if (onProgress) {
      onProgress({
        collection: collectionName,
        imported,
        errors,
        total: records.length,
        percent: Math.round((imported / records.length) * 100),
      });
    }
  }
  
  return { imported, errors };
}
