async function leaveRoom() {
  if (!room || busy) return;

  const host = isHost();
  const ref = db.collection('rooms').doc(roomCode);

  if (!host && !['lobby', 'cancelled'].includes(room.status)) {
    notify('Draft başladıktan sonra ayrılamazsın. Oda sahibinin oyunu kapatması gerekir.', true);
    return;
  }

  const question = host
    ? 'Oyunu iptal edip odayı tamamen kapatmak istiyor musun? Tüm oyuncuların bağlantısı kesilecek.'
    : 'Odadan ayrılmak istiyor musun?';

  if (!confirm(question)) return;

  busy = true;
  $('leaveRoom').disabled = true;

  try {
    if (host) {
      // Oda sahibi, draft başladıktan sonra da odayı silebilir.
      await ref.delete();

      if (roomUnsub) {
        roomUnsub();
        roomUnsub = null;
      }

      room = null;
      roomCode = '';
      localStorage.removeItem('fd_room_code');

      renderAll();
      showView('home');
      notify('Oyun iptal edildi ve oda kapatıldı. Tüm oyuncuların bağlantısı kesildi.');
    } else {
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref);

        if (!snap.exists) {
          throw new Error('Oda zaten kapatılmış.');
        }

        const data = snap.data();

        if (!['lobby', 'cancelled'].includes(data.status)) {
          throw new Error('Draft devam ederken odadan ayrılamazsın.');
        }

        const members = { ...(data.members || {}) };
        delete members[uid];

        tx.update(ref, {
          members,
          memberOrder: (data.memberOrder || []).filter(id => id !== uid),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      if (roomUnsub) {
        roomUnsub();
        roomUnsub = null;
      }

      room = null;
      roomCode = '';
      localStorage.removeItem('fd_room_code');

      renderAll();
      showView('home');
      notify('Odadan ayrıldın.');
    }
  } catch (err) {
    console.error('Oda kapatma/ayrılma hatası:', err);
    notify(firebaseError(err), true);
  } finally {
    busy = false;
    $('leaveRoom').disabled = !room || (!isHost() && !['lobby', 'cancelled'].includes(room?.status));
  }
}
