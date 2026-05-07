"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, limit, where, setDoc, arrayUnion, arrayRemove
} from "firebase/firestore";
import { auth, db } from "@/firebase";

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// ルームリストの定義
const ROOMS = [
  { id: "general1", name: "雑談1" },
  { id: "general2", name: "雑談2" },
  { id: "general3", name: "雑談3" },
  { id: "game1", name: "ゲーム1" },
  { id: "game2", name: "ゲーム2" },
  { id: "game3", name: "ゲーム3" },
  { id: "art1", name: "お絵描き1" },
  { id: "art2", name: "お絵描き2" },
  { id: "art3", name: "お絵描き3" },
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  
  const [page, setPage] = useState("home"); 
  const [activeRoom, setActiveRoom] = useState("general1"); // 現在の部屋
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // 認証と初期データ取得
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) { setMyData(snap.data()); setEditName(snap.data().name); }
        });
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(query(collection(db, "friends"), where("users", "array-contains", u.uid)), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    });
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    return () => unsubAuth();
  }, []);

  // 部屋の切り替えに合わせて投稿を取得
  useEffect(() => {
    const q = query(
      collection(db, "posts"), 
      where("room", "==", activeRoom),
      orderBy("createdAt", "desc"), 
      limit(50)
    );
    const unsub = onSnapshot(q, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [activeRoom]);

  const handleLike = async (p: any) => {
    const uid = user?.uid || "guest";
    const ref = doc(db, "posts", p.id);
    (p.likes || []).includes(uid) ? await updateDoc(ref, { likes: arrayRemove(uid) }) : await updateDoc(ref, { likes: arrayUnion(uid) });
  };

  const sendPost = async () => {
    if (!text.trim() && !postImage) return;
    setLoading(true);
    await addDoc(collection(db, "posts"), {
      text, image: postImage, room: activeRoom,
      senderUid: user?.uid || "guest", name: myData?.name || "ゲスト", 
      icon: myData?.icon || DEFAULT_ICON, displayId: myData?.displayId || "guest", 
      likes: [], createdAt: serverTimestamp()
    });
    setText(""); setPostImage(null); setLoading(false);
  };

  // 共通のボタンスタイル
  const btnStyle: React.CSSProperties = {
    cursor: "pointer",
    transition: "transform 0.1s ease, opacity 0.1s",
    border: "none",
    outline: "none",
  };

  const navItem = (target: string, label: string) => (
    <button 
      onClick={() => setPage(target)} 
      className="btn-active"
      style={{ ...btnStyle, flex: 1, padding: "15px", background: "none", color: page === target ? "#000" : "#bbb", fontWeight: "bold", fontSize: "12px" }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh", color: "#1a1a1a" }}>
      <style>{`
        .btn-active:active { transform: scale(0.96); opacity: 0.8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 20px rgba(0,0,0,0.05)" }}>
        
        {/* ヘッダー */}
        <header style={{ padding: "15px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 100 }}>
          <b style={{ fontSize: "22px", letterSpacing: "-0.5px", fontWeight: "900" }}>Chatia</b>
          <div style={{ display: "flex", gap: "10px" }}>
            {user && <button onClick={() => setPage("notify")} className="btn-active" style={{ ...btnStyle, background: "none", fontSize: "20px" }}>🔔</button>}
            {!user && <button onClick={() => setPage("auth")} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "6px 15px", borderRadius: "20px", fontSize: "12px" }}>ログイン</button>}
          </div>
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "100px" }}>
          
          {/* 1. ホーム画面 */}
          {page === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ textAlign: "center", padding: "50px 20px", background: "#000", borderRadius: "20px", color: "#fff" }}>
                <h2 style={{ margin: "0 0 10px", fontSize: "24px" }}>Chatiaへようこそ！</h2>
                <p style={{ fontSize: "14px", opacity: 0.8 }}>
                  {user ? `${myData?.name || "ユーザー"}さん、今日も楽しみましょう！` : "ゲストさん、こんにちは！"}
                </p>
              </div>

              <div style={{ border: "1px solid #eee", borderRadius: "15px", padding: "20px", background: "#fff" }}>
                <b style={{ display: "block", marginBottom: "10px", fontSize: "16px" }}>お知らせ</b>
                <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.6" }}>
                  <p>• チャットルーム（雑談・ゲーム・お絵描き）を設置しました。</p>
                  <p>• アプリ名を Chatia に変更しました。</p>
                </div>
              </div>

              <div style={{ border: "1px solid #eee", borderRadius: "15px", padding: "15px", background: "#f9f9f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>利用規約の確認</span>
                <button onClick={() => setPage("terms")} className="btn-active" style={{ ...btnStyle, color: "#007AFF", background: "none", fontWeight: "bold", fontSize: "13px" }}>確認する →</button>
              </div>
            </div>
          )}

          {/* 2. チャット（ルーム機能） */}
          {page === "global" && (
            <>
              <div className="no-scrollbar" style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "20px", paddingBottom: "5px" }}>
                {ROOMS.map(r => (
                  <button 
                    key={r.id} 
                    onClick={() => setActiveRoom(r.id)}
                    className="btn-active"
                    style={{ 
                      ...btnStyle,
                      whiteSpace: "nowrap", 
                      padding: "10px 18px", 
                      borderRadius: "10px", 
                      fontSize: "13px", 
                      fontWeight: activeRoom === r.id ? "bold" : "normal",
                      background: activeRoom === r.id ? "#000" : "#f5f5f5",
                      color: activeRoom === r.id ? "#fff" : "#666"
                    }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>

              <div style={{ border: "1px solid #eee", padding: "15px", borderRadius: "15px", marginBottom: "25px" }}>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder={`${ROOMS.find(r => r.id === activeRoom)?.name}に投稿...`} style={{ width: "100%", border: "none", outline: "none", fontSize: "16px", resize: "none" }} rows={2} />
                {postImage && <img src={postImage} style={{ width: "100%", borderRadius: "10px", marginTop: "10px" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <label className="btn-active" style={{ ...btnStyle, fontSize: "14px", color: "#666", fontWeight: "bold" }}>
                    画像
                    <input type="file" style={{ display: "none" }} onChange={e => { const r = new FileReader(); r.onload = () => setPostImage(r.result as string); r.readAsDataURL(e.target.files![0]); }} />
                  </label>
                  <button onClick={sendPost} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "8px 25px", borderRadius: "20px", fontWeight: "bold" }}>投稿</button>
                </div>
              </div>

              {posts.map(p => (
                <div key={p.id} style={{ display: "flex", gap: "12px", padding: "15px 0", borderBottom: "1px solid #f9f9f9" }}>
                  <img 
                    src={p.icon || DEFAULT_ICON} 
                    className="btn-active"
                    style={{ ...btnStyle, width: "45px", height: "45px", borderRadius: "12px", objectFit: "cover" }} 
                    onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid) || { name: p.name, icon: p.icon, displayId: p.displayId, uid: p.senderUid })} 
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <b style={{ fontSize: "14px" }}>{p.name} <span style={{ fontWeight: "normal", color: "#999" }}>@{p.displayId}</span></b>
                      <span style={{ fontSize: "11px", color: "#ccc" }}>{p.createdAt?.toDate().toLocaleTimeString()}</span>
                    </div>
                    <p style={{ margin: "5px 0", fontSize: "15px", color: "#333" }}>{p.text}</p>
                    {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px", marginTop: "8px" }} />}
                    <button onClick={() => handleLike(p)} className="btn-active" style={{ ...btnStyle, background: "none", marginTop: "8px", fontSize: "14px" }}>
                      {(p.likes || []).includes(user?.uid || "guest") ? "❤️" : "🤍"} {(p.likes || []).length}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 3. フレンド */}
          {page === "friends" && (
            <div>
              {!user ? <p style={{ textAlign: "center", marginTop: "50px" }}>ログインが必要です</p> : (
                <>
                  <h3 style={{ marginBottom: "15px" }}>フレンド</h3>
                  {friends.length === 0 && <p style={{ color: "#999" }}>まだフレンドがいません</p>}
                  {friends.map(f => {
                    const fId = f.users.find((id: string) => id !== user?.uid);
                    const info = allUsers.find(u => u.uid === fId);
                    return (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", borderBottom: "1px solid #eee" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <img src={info?.icon || DEFAULT_ICON} width="40" height="40" style={{ borderRadius: "10px", objectFit: "cover" }} />
                          <b>{info?.name}</b>
                        </div>
                        <button className="btn-active" style={{ ...btnStyle, background: "#f5f5f5", padding: "5px 15px", borderRadius: "10px", fontSize: "12px" }}>DM</button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* 4. プロフィール */}
          {page === "profile" && (
            <div style={{ textAlign: "center" }}>
              {!user ? <p>ログインが必要です</p> : (
                <>
                  <img src={myData?.icon || DEFAULT_ICON} style={{ width: "100px", height: "100px", borderRadius: "25px", objectFit: "cover", marginBottom: "20px" }} />
                  <div style={{ margin: "20px 0" }}>
                    <label className="btn-active" style={{ ...btnStyle, background: "#f5f5f5", padding: "10px 20px", borderRadius: "10px", fontSize: "14px" }}>
                      アイコン変更
                      <input type="file" style={{ display: "none" }} onChange={e => {
                        const r = new FileReader(); r.onload = () => updateDoc(doc(db, "users", user.uid), { icon: r.result as string }); r.readAsDataURL(e.target.files![0]);
                      }} />
                    </label>
                  </div>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "90%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "15px" }} />
                  <button onClick={() => updateDoc(doc(db, "users", user.uid), { name: editName })} className="btn-active" style={{ ...btnStyle, width: "90%", background: "#000", color: "#fff", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>保存</button>
                  <button onClick={() => signOut(auth)} className="btn-active" style={{ ...btnStyle, color: "red", marginTop: "40px", display: "block", width: "100%" }}>ログアウト</button>
                </>
              )}
            </div>
          )}

          {/* 利用規約 */}
          {page === "terms" && (
             <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#444" }}>
               <button onClick={() => setPage("home")} className="btn-active" style={{ ...btnStyle, marginBottom: "20px", background: "#f5f5f5", padding: "5px 15px", borderRadius: "8px" }}>戻る</button>
               <h3>利用規約</h3>
               <p>（利用規約の内容がここに入ります）</p>
             </div>
          )}

          {/* 認証 */}
          {page === "auth" && (
            <div style={{ padding: "40px 10px", textAlign: "center" }}>
              <input placeholder="メール" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <button onClick={async () => {
                const res = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: "ユーザー", displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON });
                setPage("home");
              }} className="btn-active" style={{ ...btnStyle, width: "100%", background: "#000", color: "#fff", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>新規登録</button>
              <button onClick={async () => { await signInWithEmailAndPassword(auth, email, password); setPage("home"); }} className="btn-active" style={{ ...btnStyle, width: "100%", marginTop: "10px", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }}>ログイン</button>
            </div>
          )}
        </div>

        {/* 下部ナビゲーション */}
        <nav style={{ display: "flex", borderTop: "1px solid #f0f0f0", background: "#fff", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", zIndex: 100 }}>
          {navItem("home", "ホーム")}
          {navItem("global", "チャット")}
          {navItem("friends", "フレンド")}
          {navItem("profile", "プロフ")}
        </nav>

        {/* 個別プロフポップアップ（元の機能を維持） */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "25px", textAlign: "center", width: "300px" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon || DEFAULT_ICON} style={{ width: "80px", height: "80px", borderRadius: "20px", objectFit: "cover" }} />
              <h3 style={{ margin: "10px 0 5px" }}>{selectedUser.name}</h3>
              <p style={{ color: "#999", fontSize: "12px", marginBottom: "20px" }}>@{selectedUser.displayId}</p>
              
              {!user ? (
                <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "15px" }}>
                  <p style={{ fontSize: "12px" }}>ログインすると申請を送れます</p>
                  <button onClick={() => { setPage("auth"); setSelectedUser(null); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold", marginTop: "5px" }}>ログインへ</button>
                </div>
              ) : selectedUser.uid !== user.uid ? (
                <button onClick={async () => {
                  await addDoc(collection(db, "notifications"), { fromUid: user.uid, fromName: myData.name, toUid: selectedUser.uid, type: "friend_req", createdAt: serverTimestamp() });
                  alert("申請を送りました"); setSelectedUser(null);
                }} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "12px", width: "100%", borderRadius: "15px", fontWeight: "bold" }}>フレンド申請</button>
              ) : <p style={{ color: "#ccc" }}>あなた自身です</p>}
              <button onClick={() => setSelectedUser(null)} style={{ marginTop: "20px", color: "#999", background: "none", border: "none", fontSize: "12px" }}>閉じる</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}