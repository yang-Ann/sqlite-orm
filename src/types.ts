// https://www.typescriptlang.org/docs/handbook/declaration-files/by-example.html

/** 数据类型 */
export type DataType = "INTEGER" | "LONG" | "FLOAT" | "VARCHAR" | "TEXT";

export type MyObject<T = any> = { [k in string]: T };

/** 表字段配置 */
export type TableFieldsOption = {
  /** 字段名 */
  field: string;
  /** 数据类型 */
  type: DataType;
  /** 是否是主键 */
  isKey?: boolean;
  /** 不能为空 */
  isNotNull?: boolean;
};

export type CurOperType = keyof Pick<CurOrmStoreType, "delete" | "update" | "select" | "count">;

/** ORM 保存的状态 */
export type CurOrmStoreType = {
  /** INSERT 相关操作 */
  insert?: string;
  /** 批量 INSERT 相关操作 */
  inserts?: string[];
  /** DELETE 相关操作 */
  delete?: boolean;
  /** UPDATE 相关操作 */
  update?: MyObject;
  /** SELECT 相关操作 */
  select?: string;
  /** COUNT 相关操作 */
  count?: string;
  /** 当前的操作类型 */
  curOper?: CurOperType;
  /** 是否值填充模式 */
  isFillValue: boolean;
  /** 填充的值 */
  fillValue: any[];
  /** 保存 GROUP BY */
  groupBy?: string;
  /** 保存 ORDER BY */
  orderBy?: [OrderByType, string];
  /** WHERE 条件汇总 */
  where?: string[];
  /** 是否有调用 where() */
  isSetWhere?: boolean;
  /** WHERE AND 条件 */
  and?: WhereItem[];
  /** WHERE OR 条件 */
  or?: WhereItem[];
  /** limit 条件 */
  limit?: [number, number];
};

/** WHERE 类型 */
export type WhereType = "AND" | "OR";
/** WHERE 特殊连接符 */
export type WhereConnectSpecialType = "IS NOT" | "IN" | "NOT" | "like";
/** WHERE 连接符 */
export type WhereConnectType = "=" | ">" | ">=" | "<" | "<=" | "!=" | WhereConnectSpecialType;
/** ORDER 类型 */
export type OrderByType = "ASC" | "DESC";

/** Where 项 */
export type WhereItem = {
  /** 键 */
  key: string;
  /** 连接符 */
  connect: WhereConnectType;
  /** 值 */
  value: any;
};
