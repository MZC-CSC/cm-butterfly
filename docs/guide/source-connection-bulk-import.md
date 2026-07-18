# Bulk Import of Source Connections

When you create a source group, you can register all of its servers **from a single file** instead of typing them in one at a time. This is the practical way to add dozens of servers.

**Use CSV or Excel, whichever you prefer.** The content is identical and both produce the same result.

---

## 1. Quick start

1. On the source group registration screen, click **Download Source Connection Template** to get the file layout.
2. Fill in your server details. You may open the template in Excel and save it back as **either CSV or .xlsx**.
3. Click **Import Source Connection** and pick your file.
4. **The rows to be registered are shown on screen.** Review them.
5. If everything looks right, confirm the registration.

> Choosing a file does not register anything on its own. **There is always a review step.**

---

## 2. Columns

| Column | Required | Description |
|--------|:--------:|-------------|
| `name` | **Yes** | Connection name |
| `description` | No | Free-text description |
| `ip_address` | **Yes** | Server IP address (for example `10.0.0.11`) |
| `ssh_port` | No | SSH port. Defaults to `22` when left empty |
| `user` | **Yes** | Login account (for example `ubuntu`) |
| `password` | Conditional | Password |
| `private_key` | Conditional | Full contents of the private key file |

### Filling in the credentials

**`user` is always required**, together with **at least one of `password` or `private_key`**.

- Password login → `user` + `password`
- Key login → `user` + `private_key`
- You may provide both. Whichever method works is used when connecting.

A password or private key **without** a user is an error.

### Column order

**Order does not matter.** Columns are matched by the names in the header row. The names must be exact, though — `Name` or `ip` will not be recognised.

---

## 3. ⚠️ Avoid names that are already in use

**Connection names must be unique across the whole system.**

- Not just within your group — a name already used **in a different source group** also collides.
- **Case is ignored.** `WEB-01` and `web-01` are treated as the same name.

Registration fails if a name is already taken. This can be confusing because the conflicting connection may live in **a group you are not looking at**, so the cause is not obvious.

> **Recommended** — prefix names with the environment or purpose so collisions are unlikely.
> For example: `prod-web-01`, `dev-web-01`, `idc1-db-01`

Duplicates *within your file* are caught at the review step and reported to you.

---

## 4. Writing a CSV file

### Basic layout

```csv
name,description,ip_address,ssh_port,user,password,private_key
web-01,Web server 1,10.0.0.11,22,ubuntu,mypassword,
web-02,Web server 2,10.0.0.12,22,ubuntu,mypassword,
db-01,Database server,10.0.0.21,2222,ubuntu,dbpassword,
```

Leave the last column empty when you are not using a private key. **Keep the trailing comma.**

### Values that contain a comma

Wrap the value in **double quotes**.

```csv
web-02,"Seoul IDC, rack 3",10.0.0.12,22,ubuntu,mypassword,
```

Without quotes the comma is read as a column separator and **every value after it shifts by one position**.

To include a double quote inside a value, write it twice — `"he said ""hello"""`.

### Private keys — line breaks are fine

**Wrap the whole value in double quotes and you can paste multiple lines as they are.**

```csv
name,description,ip_address,ssh_port,user,password,private_key
key-01,Key auth server,10.0.0.31,22,ubuntu,,"«BEGIN line»
«key body — as many lines as needed»
«END line»"
```

Replace `«...»` with the **entire contents of your private key file**, from the first line to the last. The number of lines does not matter.

> Escaping line breaks as `\n` on a single line still works. If you already have files written that way, keep using them.

### Saving

Save as **UTF-8**. In Excel, choose `CSV UTF-8 (Comma delimited)`. Other encodings may corrupt non-ASCII characters.

---

## 5. Writing an Excel file

The **first sheet** is read. Row 1 is the header and data starts at row 2. Columns and rules are the same as CSV.

| | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| **1** | name | description | ip_address | ssh_port | user | password | private_key |
| **2** | web-01 | Web server 1 | 10.0.0.11 | 22 | ubuntu | mypassword | |
| **3** | key-01 | Key auth server | 10.0.0.31 | 22 | ubuntu | | (full private key) |

### Why Excel is often easier

- No need to quote values containing commas — just type them into the cell.
- For multi-line values such as private keys, press `Alt` + `Enter` inside the cell.
- Encoding is not something you have to think about.

### Notes

- **Save as `.xlsx`.** The older `.xls` format cannot be read.
- **Do not password-protect the file.** Protected workbooks cannot be opened.
- Empty rows are skipped, so gaps in the sheet are harmless.

---

## 6. Reading the review screen

After you pick a file, the servers to be registered appear in a table. **Nothing is registered yet.**

- Rows with problems are listed **together with the reason**.
- Registration is blocked while any problem remains. Fix the file and import it again.
- **Every problem row is shown at once**, so you do not have to fix them one at a time.

### Common messages

| Message | How to fix |
|---------|-----------|
| Duplicate name | The same name appears more than once in your file. Case-only differences still count |
| Name already in use | The name exists elsewhere. Add a prefix to distinguish it |
| Invalid IP address | Check that it has four parts and each is 255 or less |
| Port must be between 1 and 65535 | The value is out of range, or not a whole number |
| Missing credentials | `user` is empty, or both `password` and `private_key` are empty |
| Unsupported Excel format | Save the file as `.xlsx` and try again |
| The file is password protected | Remove the password, save, and upload again |
| The file is empty | The file has a header row but no data rows |

---

## 7. Good to know

- A group can hold up to **200 connections**.
- Bulk import is available **when creating a new source group**. Adding connections to an existing group from a file is not supported yet.
- If registration fails, **nothing is created — not even the group**. You will never end up with a partially registered group.
