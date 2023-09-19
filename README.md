# 一个简单的 sqlite orm

## 安装

```sh
npm install sqlite-orm
yarn install sqlite-orm
pnpm install sqlite-orm
```

## 测试

```sh
npm run test
yarn test
pnpm test
```

## 基本使用

```ts
import SqliteOrm from "sqlite-orm";

const sqliteOrm = new SqliteOrm("test.db");

type Persion = {
  name: string;
  age: number;
  gex: "男" | "女";
};

const datas: Persion[] = [
  { name: "张三", age: 18, gex: "男" },
  { name: "李四", age: 16, gex: "男" },
  { name: "王五", age: 18, gex: "女" },
  { name: "小明", age: 30, gex: "男" },
  { name: "小张", age: 22, gex: "男" }
];

const sql0 = sqliteOrm.buildCreate([
  { field: "id", type: "INTEGER", isKey: true },
  { field: "name", type: "TEXT", isNotNull: true },
  { field: "age", type: "INTEGER", isNotNull: true },
  { field: "height", type: "FLOAT" },
  { field: "weight", type: "FLOAT" },
]);
console.log("sql0: ", sql0);
// sql0:  CREATE TABLE IF NOT EXISTS "test.db" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER NOT NULL, height FLOAT, weight FLOAT);

const sql1 = sqliteOrm
  .select()
  .where("name", "=", "张三")
  .and("age", "!=", "18")
  .or("name", "IN", ["张三", "李四", "王五"])
  .or("gex", "IS NOT", "男")
  .getSqlRaw();

console.log("sql1: ", sql1);
// sql1:  SELECT * FROM "test.db" WHERE name="张三" AND age!="18" OR name IN 张三,李四,王五 OR gex IS NOT "男"

const sql2 = sqliteOrm
  .setTableName("my_table")
  .select("name,age")
  .and("name", ">", 18) // -> 等价于 where()
  .groupBy("name")
  .orderBy("DESC", "name,age")
  .limit(1, 2)
  .getSqlRaw();

console.log("sql2: ", sql2);
// sql2:  SELECT name,age FROM "my_table" WHERE name>18 GROUP BY name ORDER BY name,age DESC LIMIT 1,2

const sql3 = sqliteOrm.select().where("name", "IN", [1, 2, "hello"]).or("age", "=", 18).getSqlRaw();

console.log("sql3: ", sql3);
// sql3:  SELECT * FROM "my_table" WHERE name IN (1,2,"hello") OR age=18

const sql4 = sqliteOrm
  .select()
  .whereArray("name", "=", [1, 2, "hello"], "AND")
  .or("age", "=", 18)
  .and("gex", "IN", [1, 2, 3])
  .andArray("gex", "!=", [1, "2", false])
  .getSqlRaw();

console.log("sql4: ", sql4);
// SELECT * FROM "my_table" WHERE ( name=1 AND name=2 AND name="hello" ) OR age=18 AND gex IN (1,2,3) AND ( gex!=1 AND gex!="2" AND gex!=0 )

const sql5 = sqliteOrm.count("id").where("age", ">", 18).and("gex", "=", "男").groupBy("name").getSqlRaw();

console.log("sql5: ", sql5);
// SELECT * FROM "my_table" WHERE ( name=1 AND name=2 AND name="hello" ) OR age=18 AND gex IN (1,2,3) AND ( gex!=1 AND gex!="2" AND gex!=0 )

const sql6 = sqliteOrm.inser<Persion & { isFlag: boolean }>({
  name: "张三",
  age: 18,
  gex: "男",
  isFlag: true // -> true = 1, false = 0
});

console.log("sql6: ", sql6);
// sql6:  INSERT or REPLACE INTO "test.db" (name, age, gex, isFlag) VALUES ("张三", 18, "男", 1)

const sql7 = sqliteOrm.insers<Persion[]>(datas, 6); // 一个语句最多6个变量

console.log("sql7: ", sql7);
// sql7:  [
//   'INSERT or REPLACE INTO "test.db"  (name, age, gex) VALUES  ("张三", 18, "男"), ("李四", 16, "男")',
//   'INSERT or REPLACE INTO "test.db"  (name, age, gex) VALUES  ("王五", 18, "女"), ("小明", 30, "男")',
//   'INSERT or REPLACE INTO "test.db"  (name, age, gex) VALUES  ("小张", 22, "男")'
// ]

const sql8 = sqliteOrm.addColumn("new_name", "TEXT");
console.log("sql8: ", sql8);
// sql8:  SELECT * FROM "sqlite_master" WHERE type="table" AND name="my_table"

const sql9 = sqliteOrm.tableInfo();
console.log("sql9: ", sql9);
// sql9:  SELECT * FROM "sqlite_master" WHERE type="table" AND name="my_table"


/**
 * 姓名修改为 name-age-gex 格式
 * 年龄增大10倍
 */
const sql10 = sqliteOrm.buildUpdateByWhen({
  datas,
  onceMaxUpdateDataLength: 2, // 一个语句最多更新2条数据
  fieldOpts: [
    {
      setField: "name",
      getWhenField() {
        return "name";
      },
      getWhenValue(row) {
        return row.name;
      },
      getThenValue(row) {
        return `${row.name}-${row.age}-${row.gex}`;
      },
    },
    {
      setField: "age",
      getWhenField() {
        return "age";
      },
      getWhenValue(row) {
        return row.age;
      },
      getThenValue(row) {
        return row.age * 10;
      },
    }
  ]
});
console.log("sql10: ", sql10);
// sql10:  [
//   'UPDATE "my_table" SET name = CASE WHEN name="张三" THEN "张三-18-男" WHEN name="李四" THEN "李四-16-男" END, age = CASE WHEN age="18" THEN "180" WHEN age="16" THEN "160" END  ',
//   'UPDATE "my_table" SET name = CASE WHEN name="王五" THEN "王五-18-女" WHEN name="小明" THEN "小明-30-男" END, age = CASE WHEN age="18" THEN "180" WHEN age="30" THEN "300" END  ',
//   'UPDATE "my_table" SET name = CASE WHEN name="小张" THEN "小张-22-男" END, age = CASE WHEN age="22" THEN "220" END  '
// ]

const sql12 = sqliteOrm.setVersion(2);
console.log("sql12: ", sql12);
// sql12:  PRAGMA user_version = 2

const sql13 = sqliteOrm.findById(1);
console.log("sql13: ", sql13);
// sql13:  SELECT * FROM "my_table" WHERE id=1

const sql14 = sqliteOrm.selectAll();
console.log("sql14: ", sql14);
// sql14:  SELECT * FROM "my_table"

const sql15 = sqliteOrm.deleteById(1);
console.log("sql15: ", sql15);
// sql15:  DELETE FROM "my_table" WHERE id=1

const sql16 = sqliteOrm.deleteAll("hello.db");
console.log("sql16: ", sql16);
// sql16:  DELETE FROM "hello.db" WHERE 1=1

const sql17 = sqliteOrm.deleteTable("hello.db");
console.log("sql17: ", sql17);
// sql17:  DROP TABLE IF EXISTS "hello.db"

```