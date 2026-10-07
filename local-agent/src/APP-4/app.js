document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('user-types-table-body');
  const searchInput = document.getElementById('search-input');
  const countBadge = document.getElementById('user-count');
  
  const modalElement = document.getElementById('user-modal');
  const userModal = new bootstrap.Modal(modalElement);
  const userForm = document.getElementById('user-form');
  const modalTitle = document.getElementById('modal-title');
  const saveBtn = document.getElementById('save-btn');

  const userIdInput = document.getElementById('user-id');
  const userNifInput = document.getElementById('user-nif');
  const userNameInput = document.getElementById('user-name');
  const userDescInput = document.getElementById('user-desc');
  const userAltaInput = document.getElementById('user-alta');
  const userBajaInput = document.getElementById('user-baja');

  const btnNew = document.getElementById('btn-new');
  const alertContainer = document.getElementById('alert-container');

  let users = [...window.usersData];

  function showAlert(message, type = 'success') {
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    setTimeout(() => {
      alertContainer.innerHTML = '';
    }, 4000);
  }

  function renderTable(data) {
    tableBody.innerHTML = '';
    countBadge.textContent = data.length;

    if (data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted py-4">
            No se encontraron tipos de usuario
          </td>
        </tr>
      `;
      return;
    }

    data.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="text-secondary">#${user.id}</span></td>
        <td><strong>${user.nif || '-'}</strong></td>
        <td>
          <div class="font-weight-medium">${user.nombre}</div>
        </td>
        <td class="text-muted">${user.descripcion || '-'}</td>
        <td><span class="text-muted">${user.fecha_alta ? user.fecha_alta.substring(0, 10) : '-'}</span></td>
        <td><span class="text-muted">${user.fecha_baja ? user.fecha_baja.substring(0, 10) : '-'}</span></td>
        <td class="text-end">
          <div class="btn-list flex-nowrap justify-content-end">
            <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${user.id}">
              Editar
            </button>
            <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${user.id}">
              Eliminar
            </button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    attachRowEvents();
  }

  function filterUsers() {
    const query = searchInput.value.toLowerCase().trim();
    const filtered = users.filter(u => {
      const nombre = (u.nombre || '').toLowerCase();
      const nif = (u.nif || '').toLowerCase();
      const desc = (u.descripcion || '').toLowerCase();
      return nombre.includes(query) || nif.includes(query) || desc.includes(query);
    });
    renderTable(filtered);
  }

  searchInput.addEventListener('input', filterUsers);

  btnNew.addEventListener('click', () => {
    userForm.reset();
    userIdInput.value = '';
    modalTitle.textContent = 'Nuevo Tipo de Usuario';
    userAltaInput.value = new Date().toISOString().substring(0, 10);
    userModal.show();
  });

  function attachRowEvents() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        const user = users.find(u => u.id === id);
        if (!user) return;

        userIdInput.value = user.id;
        userNifInput.value = user.nif || '';
        userNameInput.value = user.nombre || '';
        userDescInput.value = user.descripcion || '';
        userAltaInput.value = user.fecha_alta ? user.fecha_alta.substring(0, 10) : '';
        userBajaInput.value = user.fecha_baja ? user.fecha_baja.substring(0, 10) : '';

        modalTitle.textContent = 'Editar Tipo de Usuario';
        userModal.show();
      });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        const user = users.find(u => u.id === id);
        if (!user) return;

        if (confirm(`¿Estás seguro de que deseas eliminar el tipo de usuario "${user.nombre}"?`)) {
          users = users.filter(u => u.id !== id);
          filterUsers();
          showAlert(`Tipo de usuario "${user.nombre}" eliminado correctamente.`, 'warning');
        }
      });
    });
  }

  saveBtn.addEventListener('click', () => {
    if (!userForm.checkValidity()) {
      userForm.reportValidity();
      return;
    }

    const idVal = userIdInput.value;
    const nifVal = userNifInput.value.trim();
    const nombreVal = userNameInput.value.trim();
    const descVal = userDescInput.value.trim();
    const altaVal = userAltaInput.value;
    const bajaVal = userBajaInput.value;

    if (idVal) {
      // Edit
      const id = Number(idVal);
      const index = users.findIndex(u => u.id === id);
      if (index !== -1) {
        users[index] = {
          ...users[index],
          nif: nifVal,
          nombre: nombreVal,
          descripcion: descVal,
          fecha_alta: altaVal ? new Date(altaVal).toISOString() : null,
          fecha_baja: bajaVal ? new Date(bajaVal).toISOString() : null
        };
        showAlert(`Tipo de usuario "${nombreVal}" actualizado con éxito.`);
      }
    } else {
      // Create
      const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
      const newUser = {
        id: newId,
        nif: nifVal,
        nombre: nombreVal,
        descripcion: descVal,
        fecha_alta: altaVal ? new Date(altaVal).toISOString() : new Date().toISOString(),
        fecha_baja: bajaVal ? new Date(bajaVal).toISOString() : null
      };
      users.unshift(newUser);
      showAlert(`Tipo de usuario "${nombreVal}" creado con éxito.`);
    }

    userModal.hide();
    filterUsers();
  });

  // Initial render
  renderTable(users);
});
