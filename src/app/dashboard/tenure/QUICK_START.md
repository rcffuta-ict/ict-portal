# 🚀 Tenure Module - Quick Start Guide

## 📖 Documentation Files (Read These!)

1. **START HERE**: `CLEANUP_SUMMARY.md` - What changed and why
2. **OVERVIEW**: `README.md` - Complete module documentation
3. **REFERENCE**: `ACTIONS_REFERENCE.md` - All actions with examples

---

## 🎯 Quick Understanding

### What is this module?
The Tenure Module is an admin dashboard for managing:
- 📅 **Tenures** (fellowship sessions/years)
- 🏗️ **Structure** (units, teams, ministries)
- 👑 **Leadership** (cabinet positions & appointments)
- 👥 **Families** (entry year groups)

### Who can access it?
Only users whose emails are in the `ADMIN_EMAILS` environment variable.

---

## 📂 File Map (What to Look at)

```
📁 tenure/
│
├── 📄 page.tsx                  ← START: Main dashboard, tab navigation
├── ⚙️  actions.ts                ← Server actions (all backend operations)
│
├── 📚 Documentation
│   ├── README.md               ← Full module guide
│   ├── ACTIONS_REFERENCE.md    ← Action usage details
│   ├── CLEANUP_SUMMARY.md      ← What we cleaned up
│   └── QUICK_START.md          ← You are here!
│
└── 📁 components/
    ├── tenure-tab.tsx          ← Create/edit/close tenures
    ├── structure-tab.tsx       ← Manage units & teams
    ├── cabinet-tab.tsx         ← Assign leadership roles
    ├── family-tab.tsx          ← Name entry year families
    └── manage-unit-modal.tsx   ← Manage unit-specific leaders
```

---

## 🔄 How Data Flows

### Loading Data (on page load)
```
page.tsx loads
  ↓
calls getAdminData()
  ↓
fetches: tenures, units, families, positions, leadership
  ↓
passes data to active tab component
  ↓
tab renders UI
```

### Saving Changes (form submission)
```
User fills form
  ↓
Submit triggers server action (e.g., createTenureAction)
  ↓
Action validates admin access
  ↓
Action updates database
  ↓
Action calls revalidatePath()
  ↓
Component calls onSuccess()
  ↓
page.tsx calls refresh() → reloads all data
  ↓
UI updates
```

---

## 🎓 Common Questions

### Q: How do I add a new feature?
1. Read `README.md` section "Adding a New Server Action"
2. Create action in `actions.ts`
3. Use action in component
4. Update `ACTIONS_REFERENCE.md`

### Q: Which action should I use?
Check `ACTIONS_REFERENCE.md` - it has a table mapping actions to use cases.

### Q: How do I debug issues?
1. Check browser console (client errors)
2. Check server logs (action errors)
3. Verify `ADMIN_EMAILS` environment variable
4. Use Network tab to see failed requests

### Q: Where is the action used?
See "Action Usage Map" table in `ACTIONS_REFERENCE.md`

### Q: How do I modify a component?
1. Locate component in `components/` folder
2. Follow existing patterns (FormInput, FormSelect)
3. Use `data` prop for reading, `onSuccess()` for refreshing
4. Handle errors with user-friendly messages

---

## ⚡ Quick Reference

### Server Actions Pattern
```typescript
export async function myAction(formData: FormData) {
    const rcf = await checkAdminAccess();  // Always first!
    try {
        // Your logic here
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
```

### Component Pattern
```typescript
const handleSubmit = async (formData: FormData) => {
    const res = await myAction(formData);
    if (res.success) {
        onSuccess();  // Refresh data
    } else {
        alert("Error: " + res.error);
    }
};
```

---

## 🛠️ Development Workflow

1. **Understand**: Read `README.md`
2. **Reference**: Check `ACTIONS_REFERENCE.md` for action details
3. **Modify**: Edit component/action
4. **Test**: Run in browser, check console
5. **Document**: Update relevant .md files

---

## ✅ All Files Are Now:
- ✨ Clean (no commented code)
- 📝 Documented (JSDoc + markdown)
- 🎯 Organized (logical sections)
- 🔧 Functional (all features work)
- 🎨 Consistent (same patterns everywhere)

---

## 🎉 You're Ready!

**Next Steps:**
1. Read `CLEANUP_SUMMARY.md` to see what changed
2. Skim `README.md` for overall understanding
3. Bookmark `ACTIONS_REFERENCE.md` for quick lookups
4. Start developing with confidence! 🚀

**Need Help?**
- Lost? → Read `README.md`
- Action question? → Check `ACTIONS_REFERENCE.md`
- Quick lookup? → This file (QUICK_START.md)

Happy coding! 💻
